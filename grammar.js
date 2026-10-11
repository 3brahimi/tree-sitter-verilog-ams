/**
 * @file Verilog-AMS and Verilog-A grammar for tree-sitter
 * @author Masoud Ebrahimi
 * @license MIT
 *
 * Extends tree-sitter-systemverilog (MIT, Copyright (c) 2024-2025 Gonzalo M.
 * Larumbe) through grammar inheritance, the same way tree-sitter-cpp extends
 * tree-sitter-c. The base grammar is vendored unmodified under
 * vendor/tree-sitter-systemverilog (see vendor/tree-sitter-systemverilog/PIN).
 *
 * Only Verilog-AMS rules are added here. Clause numbers in comments refer to
 * the Accellera Verilog-AMS Language Reference Manual, version 2.4.
 *
 * Function-like AMS names (analog operators, `above`/`timer`, and the `V`/`I`
 * access functions) and scale-factor literals are recognised by the external
 * scanner in src/scanner.c. It emits those tokens only when the name is
 * directly followed by `(` (or, for numbers, when the scale letter is not
 * followed by another identifier character), so SystemVerilog code that uses
 * the same words as plain identifiers, or time literals such as `1ns`, keeps
 * its original parse.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

'use strict';

const base = require('./vendor/tree-sitter-systemverilog/grammar.js');

function optseq(...rules) {
  return optional(seq(...rules));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

// Clause 9 (system tasks and functions): analog-only system functions. Names
// that SystemVerilog also defines ($strobe, $display, $random, ...) are left to
// the base grammar.
const ANALOG_SYSTEM_FUNCTIONS = [
  '$abstime', '$analog_node_alias', '$analog_port_alias', '$angle',
  '$arandom', '$bound_step', '$debug', '$discontinuity', '$fdebug', '$hflip',
  '$limit', '$mfactor', '$param_given', '$port_connected', '$rdist_chi_square',
  '$rdist_erlang', '$rdist_exponential', '$rdist_normal', '$rdist_poisson',
  '$rdist_t', '$rdist_uniform', '$simparam', '$simparam$str', '$simprobe',
  '$table_model', '$temperature', '$vflip', '$vt', '$xposition',
  '$yposition',
];

// SystemVerilog keywords that are ordinary identifiers in Verilog-AMS (they
// are not in the Verilog-AMS keyword list of LRM 2.4 Annex B). Compact models
// commonly declare a `type` parameter and `(* type = "instance" *)`
// attributes. These words stay keywords wherever SystemVerilog syntax expects
// them; they are only no longer reserved everywhere.
const UNRESERVED_SV_KEYWORDS = new Set(['type', 'ref', 'iff']);

module.exports = grammar(base, {
  name: 'verilog_ams',

  reserved: {
    global: ($, original) => original.filter(
      (rule) => !(rule.type === 'STRING' && UNRESERVED_SV_KEYWORDS.has(rule.value)),
    ),
    macros: _ => [],
  },

  externals: $ => [
    $.scaled_real_number,
    $._analog_operator_name,
    $._analog_event_name,
    $._access_function_name,
    $._contribution_access_name,
    $._error_sentinel,
  ],

  conflicts: ($, original) => original.concat([
    // `exclude (` starts either a range, `exclude (lo:hi)`, or a
    // parenthesised single value, `exclude (x)`.
    [$.parameter_value_range, $.parameter_value_range_type],
  ]),

  rules: {
    // ** Clauses 3, 6 and 7: top-level declarations
    _description: ($, original) => choice(
      original,
      $.nature_declaration,
      $.discipline_declaration,
      $.connectrules_declaration,
      $.paramset_declaration,
    ),

    // 7.5 and 7.6: connect modules use the `connectmodule` keyword.
    module_keyword: ($, original) => choice(original, 'connectmodule'),

    _module_common_item: ($, original) => choice(original, $.analog_construct),

    _module_or_generate_item_declaration: ($, original) => choice(
      original,
      $.branch_declaration,
      $.ground_declaration,
      $.analog_function_declaration,
      $.aliasparam_declaration,
    ),

    // 3.7: real nets.
    net_type: ($, original) => choice(original, 'wreal'),

    // ** 3.6.1 Natures
    nature_declaration: $ => seq(
      'nature',
      field('name', $._identifier),
      optseq(':', field('parent', $.parent_nature)),
      optional(';'),
      repeat($.nature_attribute),
      'endnature',
    ),

    parent_nature: $ => choice(
      $._identifier,
      seq($._identifier, '.', $.potential_or_flow),
    ),

    nature_attribute: $ => seq(
      field('name', $._identifier),
      '=',
      field('value', $.constant_expression),
      ';',
    ),

    // ** 3.6.2 Disciplines
    // `logic` is a reserved SystemVerilog keyword but also the name of the
    // standard discrete discipline, so it is accepted where a discipline name
    // is expected.
    _discipline_identifier: $ => choice($._identifier, alias('logic', $.simple_identifier)),

    discipline_declaration: $ => seq(
      'discipline',
      field('name', $._discipline_identifier),
      optional(';'),
      repeat($._discipline_item),
      'enddiscipline',
    ),

    _discipline_item: $ => choice(
      $.nature_binding,
      $.discipline_domain_binding,
      $.nature_attribute_override,
    ),

    nature_binding: $ => seq($.potential_or_flow, field('nature', $._identifier), ';'),

    potential_or_flow: _ => choice('potential', 'flow'),

    discipline_domain_binding: $ => seq('domain', $.discrete_or_continuous, ';'),

    discrete_or_continuous: _ => choice('discrete', 'continuous'),

    nature_attribute_override: $ => seq($.potential_or_flow, '.', $.nature_attribute),

    // ** 3.6.4 Ground declaration
    ground_declaration: $ => seq(
      'ground',
      optional(field('discipline', $._discipline_identifier)),
      optional($.packed_dimension),
      commaSep1(field('name', $._identifier)),
      ';',
    ),

    // ** 3.4.2 Value range specification: `from` and `exclude`
    param_assignment: ($, original) => seq(original, repeat($.parameter_value_range)),

    parameter_value_range: $ => choice(
      seq(
        field('type', $.parameter_value_range_type),
        choice('(', '['),
        field('low', $._value_range_expression),
        ':',
        field('high', $._value_range_expression),
        choice(')', ']'),
      ),
      seq(field('type', $.parameter_value_range_type), $.assignment_pattern),
      seq(field('type', alias('exclude', $.parameter_value_range_type)), $.constant_expression),
    ),

    parameter_value_range_type: _ => choice('from', 'exclude'),

    _value_range_expression: $ => choice($.constant_expression, $.infinity),

    infinity: _ => seq(optional(choice('-', '+')), 'inf'),

    // ** 3.4.7 Parameter aliases
    aliasparam_declaration: $ => seq(
      'aliasparam',
      field('alias', $._identifier),
      '=',
      field('parameter', $._identifier),
      ';',
    ),

    // ** 3.12 Branches (3.12.1 port branches)
    branch_declaration: $ => seq(
      'branch',
      '(',
      choice(
        seq('<', field('port', $.hierarchical_identifier), '>'),
        seq($.branch_terminal, optseq(',', $.branch_terminal)),
      ),
      ')',
      commaSep1(field('name', $._identifier)),
      ';',
    ),

    // Compact models often name internal nodes through macros:
    // `V(`IntrinsicGate, `IntrinsicBody)`.
    branch_terminal: $ => choice(
      seq($.hierarchical_identifier, optional($.constant_select)),
      $.text_macro_usage,
    ),

    // ** 4.4 Signal access functions
    // `V(a)`, `V(a, b)`, `I(br)` and port branches `I(<p>)`. In expressions only
    // the `V` and `I` access names are recognised (scanner token); other
    // access names parse as ordinary function calls there. As the target of a
    // contribution any access name is accepted.
    branch_probe: $ => seq(
      field('access', alias($._access_function, $.hierarchical_identifier)),
      $._branch_probe_arguments,
    ),

    // Wrapped so the access name has the same shape in both probe forms:
    // (hierarchical_identifier (simple_identifier)).
    _access_function: $ => alias($._access_function_name, $.simple_identifier),

    // Target of a contribution. The scanner emits the access name only when
    // the balanced `( ... )` after it is followed by `<+` or by a single `:`,
    // so any access name works here (`Pwr(a) <+ x;`) while `task(a);` stays
    // a task call, without any parser-level ambiguity.
    _contribution_target: $ => seq(
      field('access', alias($._contribution_access, $.hierarchical_identifier)),
      $._branch_probe_arguments,
    ),

    _contribution_access: $ => alias($._contribution_access_name, $.simple_identifier),

    _branch_probe_arguments: $ => seq(
      '(',
      choice(
        seq('<', field('port', $.hierarchical_identifier), '>'),
        seq(field('terminal', $.branch_terminal), optseq(',', field('terminal', $.branch_terminal))),
      ),
      ')',
    ),

    _branch_lvalue: $ => alias($._contribution_target, $.branch_probe),

    // ** 4.5 Analog operators and 4.6 analysis dependent functions
    analog_operator_call: $ => seq(
      field('name', alias($._analog_operator_name, $.analog_operator)),
      '(',
      optional($.list_of_arguments),
      ')',
    ),

    primary: ($, original) => choice(
      original,
      $.analog_operator_call,
      $.branch_probe,
      // A parameter named `type` (common in compact models) used as a value.
      // `type(` still starts the SystemVerilog type operator.
      seq(alias($._type_as_identifier, $.hierarchical_identifier), optional($.select)),
    ),

    _type_as_identifier: $ => alias('type', $.simple_identifier),

    // ** 2.6.2 Real constants with a scale factor (1k, 10n, 2.5u)
    real_number: ($, original) => choice(original, $.scaled_real_number),

    // ** 5.2 Analog procedural blocks
    analog_construct: $ => seq(
      'analog',
      optional('initial'),
      field('body', $.statement_or_null),
    ),

    // ** 4.7 Analog user defined functions
    analog_function_declaration: $ => seq('analog', $.function_declaration),

    // ** 5.6 Contribution statements
    statement_item: ($, original) => choice(
      original,
      $.contribution_statement,
      $.indirect_contribution_statement,
    ),

    contribution_statement: $ => seq(
      field('lvalue', $._branch_lvalue),
      '<+',
      field('value', $.expression),
      ';',
    ),

    // 5.6.7: indirect branch contribution, `V(out) : V(in) == 0;`
    indirect_contribution_statement: $ => seq(
      field('lvalue', $._branch_lvalue),
      ':',
      field('equation', $.expression),
      ';',
    ),

    // ** 5.10 Analog events: global (5.10.2) and monitored (5.10.3)
    event_expression: ($, original) => choice(original, $.analog_event_function),

    analog_event_function: $ => choice(
      seq(
        field('name', choice(
          alias('cross', $.analog_event_name),
          alias($._analog_event_name, $.analog_event_name),
        )),
        '(',
        optional($.list_of_arguments),
        ')',
      ),
      seq(
        field('name', alias(choice('initial_step', 'final_step'), $.analog_event_name)),
        optseq('(', optional($.list_of_arguments), ')'),
      ),
    ),

    // ** Clause 9: analog system functions
    subroutine_call: ($, original) => choice(original, $.analog_system_tf_call),

    analog_system_tf_call: $ => prec.right(seq(
      field('name', $.analog_system_function),
      optseq('(', optional($.list_of_arguments), ')'),
    )),

    analog_system_function: _ => choice(...ANALOG_SYSTEM_FUNCTIONS),

    // ** 7.7 Connect rules (7.7.1 auto-insertion statement)
    connectrules_declaration: $ => seq(
      'connectrules',
      field('name', $._identifier),
      ';',
      repeat(choice($.connect_insertion, $.connect_resolution)),
      'endconnectrules',
    ),

    connect_insertion: $ => seq(
      'connect',
      field('module', $._identifier),
      optional($.connect_mode),
      optional($.parameter_value_assignment),
      optional($.connect_port_overrides),
      ';',
    ),

    connect_mode: _ => choice('merged', 'split'),

    connect_port_overrides: $ => choice(
      seq($._discipline_identifier, ',', $._discipline_identifier),
      seq('input', $._discipline_identifier, ',', 'output', $._discipline_identifier),
      seq('output', $._discipline_identifier, ',', 'input', $._discipline_identifier),
      seq('inout', $._discipline_identifier, ',', 'inout', $._discipline_identifier),
    ),

    connect_resolution: $ => seq(
      'connect',
      commaSep1(field('discipline', $._discipline_identifier)),
      'resolveto',
      field('result', choice($._discipline_identifier, 'exclude')),
      ';',
    ),

    // ** 6.4 Paramsets
    paramset_declaration: $ => seq(
      'paramset',
      field('name', $._identifier),
      field('module', $._identifier),
      optional(';'), // Some simulators accept the header without `;`.
      repeat(choice($.block_item_declaration, $.aliasparam_declaration)),
      repeat($.paramset_statement),
      'endparamset',
    ),

    paramset_statement: $ => choice(
      seq('.', field('name', $._identifier), '=', field('value', $.constant_expression), ';'),
      $.statement,
    ),
  },
});
