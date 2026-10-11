/*
 * External scanner for tree-sitter-verilog-ams.
 *
 * Copyright (c) 2026 Masoud Ebrahimi. MIT License, see LICENSE.
 *
 * It recognises tokens that need lookahead past the end of the token, which
 * the generated lexer cannot express:
 *
 *   - real constants with a scale factor (LRM 2.4 clause 2.6.2), such as `1k`,
 *     `10n` or `2.5u`. The scale letter must not be followed by another
 *     identifier character, so SystemVerilog time literals such as `1ns`,
 *     `10ms` or `1fs` still lex as a number followed by a time unit.
 *   - analog operator names (clause 4.5 and 4.6), the `above` and `timer`
 *     event names (clause 5.10.3) and the `V`/`I` access functions (clause 4.4),
 *     only when the name is followed by `(`. The same words used as plain
 *     identifiers keep lexing as identifiers.
 *   - the access name at the start of a contribution statement (clause 5.6),
 *     for any access name (`V`, `I`, `Pwr`, ...), only when the balanced
 *     `( ... )` after it is followed by `<+` or by a single `:` (indirect
 *     contribution). A task call such as `f(a);` is left to the parser.
 */

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>

enum TokenType {
  SCALED_REAL_NUMBER,
  ANALOG_OPERATOR_NAME,
  ANALOG_EVENT_NAME,
  ACCESS_FUNCTION_NAME,
  CONTRIBUTION_ACCESS_NAME,
  ERROR_SENTINEL,
};

#define MAX_NAME_LENGTH 32
#define MAX_LOOKAHEAD 4096

static const char *const ANALOG_OPERATORS[] = {
  "absdelay", "ac_stim", "analysis", "ddt", "ddx", "flicker_noise", "idt",
  "idtmod", "laplace_nd", "laplace_np", "laplace_zd", "laplace_zp",
  "last_crossing", "limexp", "noise_table", "noise_table_log", "slew",
  "transition", "white_noise", "zi_nd", "zi_np", "zi_zd", "zi_zp", NULL,
};

static const char *const ANALOG_EVENTS[] = {"above", "timer", NULL};

static const char *const ACCESS_FUNCTIONS[] = {"I", "V", NULL};

static const char SCALE_FACTORS[] = "TGMKkmunpfa";

static bool is_digit(int32_t c) { return c >= '0' && c <= '9'; }

static bool is_alpha(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

static bool is_identifier_char(int32_t c) {
  return is_alpha(c) || is_digit(c) || c == '$';
}

static bool is_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v';
}

static bool in_list(const char *const *list, const char *word) {
  for (size_t i = 0; list[i] != NULL; i++) {
    if (strcmp(list[i], word) == 0) {
      return true;
    }
  }
  return false;
}

static void consume_digits(TSLexer *lexer) {
  while (is_digit(lexer->lookahead) || lexer->lookahead == '_') {
    lexer->advance(lexer, false);
  }
}

/* unsigned_number [ . unsigned_number ] scale_factor, not followed by an
 * identifier character. */
static bool scan_scaled_real(TSLexer *lexer) {
  consume_digits(lexer);
  if (lexer->lookahead == '.') {
    lexer->advance(lexer, false);
    if (!is_digit(lexer->lookahead)) {
      return false;
    }
    consume_digits(lexer);
  }
  if (lexer->lookahead <= 0 || lexer->lookahead > 127 ||
      strchr(SCALE_FACTORS, (int)lexer->lookahead) == NULL) {
    return false;
  }
  lexer->advance(lexer, false);
  if (is_identifier_char(lexer->lookahead)) {
    return false;
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = SCALED_REAL_NUMBER;
  return true;
}

/* Skips a string literal; the opening quote is the current lookahead. */
static bool skip_string(TSLexer *lexer, unsigned *budget) {
  lexer->advance(lexer, false);
  while (*budget > 0 && !lexer->eof(lexer)) {
    (*budget)--;
    int32_t c = lexer->lookahead;
    lexer->advance(lexer, false);
    if (c == '\\') {
      if (lexer->eof(lexer)) {
        return false;
      }
      lexer->advance(lexer, false);
    } else if (c == '"') {
      return true;
    } else if (c == '\n') {
      return false;
    }
  }
  return false;
}

/* Skips whitespace and comments. Returns false on an unterminated comment
 * or when the budget runs out. */
static bool skip_space_and_comments(TSLexer *lexer, unsigned *budget) {
  while (*budget > 0) {
    (*budget)--;
    if (is_space(lexer->lookahead)) {
      lexer->advance(lexer, false);
      continue;
    }
    if (lexer->lookahead != '/') {
      return true;
    }
    lexer->advance(lexer, false);
    if (lexer->lookahead == '/') {
      while (!lexer->eof(lexer) && lexer->lookahead != '\n') {
        lexer->advance(lexer, false);
      }
    } else if (lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      int32_t previous = 0;
      while (!(previous == '*' && lexer->lookahead == '/')) {
        if (lexer->eof(lexer) || *budget == 0) {
          return false;
        }
        (*budget)--;
        previous = lexer->lookahead;
        lexer->advance(lexer, false);
      }
      lexer->advance(lexer, false);
    } else {
      /* A lone `/` is not a comment; nothing else can follow here. */
      return false;
    }
  }
  return false;
}

/* The lookahead is `(`. Consumes the balanced parenthesised group and
 * reports whether `<+` or a single `:` follows it. Gives up at `;`. */
static bool is_contribution_ahead(TSLexer *lexer) {
  unsigned budget = MAX_LOOKAHEAD;
  int depth = 0;
  while (budget > 0 && !lexer->eof(lexer)) {
    budget--;
    int32_t c = lexer->lookahead;
    if (c == '"') {
      if (!skip_string(lexer, &budget)) {
        return false;
      }
      continue;
    }
    if (c == ';') {
      return false;
    }
    lexer->advance(lexer, false);
    if (c == '(') {
      depth++;
    } else if (c == ')') {
      depth--;
      if (depth == 0) {
        break;
      }
    }
  }
  if (depth != 0) {
    return false;
  }
  if (!skip_space_and_comments(lexer, &budget)) {
    return false;
  }
  if (lexer->lookahead == '<') {
    lexer->advance(lexer, false);
    return lexer->lookahead == '+';
  }
  if (lexer->lookahead == ':') {
    lexer->advance(lexer, false);
    return lexer->lookahead != ':';
  }
  return false;
}

/* A name followed (after optional whitespace) by `(`. The token ends at the
 * name; everything after it is only looked at. */
static bool scan_name(TSLexer *lexer, const bool *valid_symbols) {
  char word[MAX_NAME_LENGTH + 1];
  size_t length = 0;
  while (is_identifier_char(lexer->lookahead)) {
    if (length == MAX_NAME_LENGTH) {
      return false;
    }
    word[length++] = (char)lexer->lookahead;
    lexer->advance(lexer, false);
  }
  word[length] = '\0';
  lexer->mark_end(lexer);

  while (is_space(lexer->lookahead)) {
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead != '(') {
    return false;
  }

  bool is_access = valid_symbols[ACCESS_FUNCTION_NAME] && in_list(ACCESS_FUNCTIONS, word);
  bool is_operator = valid_symbols[ANALOG_OPERATOR_NAME] && in_list(ANALOG_OPERATORS, word);
  bool is_event = valid_symbols[ANALOG_EVENT_NAME] && in_list(ANALOG_EVENTS, word);

  /* Decided last because it consumes the rest of the statement head. The
   * token end is already marked, so the other results stay usable. At the
   * start of a statement an access name that is not a contribution target is
   * left to the parser, so `V(a);` stays a task call. */
  if (valid_symbols[CONTRIBUTION_ACCESS_NAME]) {
    if (is_contribution_ahead(lexer)) {
      lexer->result_symbol = CONTRIBUTION_ACCESS_NAME;
      return true;
    }
    is_access = false;
  }
  if (is_access) {
    lexer->result_symbol = ACCESS_FUNCTION_NAME;
    return true;
  }
  if (is_operator) {
    lexer->result_symbol = ANALOG_OPERATOR_NAME;
    return true;
  }
  if (is_event) {
    lexer->result_symbol = ANALOG_EVENT_NAME;
    return true;
  }
  return false;
}

void *tree_sitter_verilog_ams_external_scanner_create(void) { return NULL; }

void tree_sitter_verilog_ams_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_verilog_ams_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_verilog_ams_external_scanner_deserialize(void *payload, const char *buffer,
                                                          unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_verilog_ams_external_scanner_scan(void *payload, TSLexer *lexer,
                                                   const bool *valid_symbols) {
  (void)payload;
  /* The sentinel is never used by a rule, so it is only valid during error
   * recovery, where every token is marked valid. */
  if (valid_symbols[ERROR_SENTINEL]) {
    return false;
  }
  bool want_number = valid_symbols[SCALED_REAL_NUMBER];
  bool want_name = valid_symbols[ANALOG_OPERATOR_NAME] || valid_symbols[ANALOG_EVENT_NAME] ||
                   valid_symbols[ACCESS_FUNCTION_NAME] || valid_symbols[CONTRIBUTION_ACCESS_NAME];
  if (!want_number && !want_name) {
    return false;
  }

  while (is_space(lexer->lookahead)) {
    lexer->advance(lexer, true);
  }

  if (want_number && is_digit(lexer->lookahead)) {
    return scan_scaled_real(lexer);
  }
  if (want_name && is_alpha(lexer->lookahead)) {
    return scan_name(lexer, valid_symbols);
  }
  return false;
}
