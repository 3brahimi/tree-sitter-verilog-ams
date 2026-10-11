#!/bin/sh
# Regenerate src/parser.c, src/grammar.json and src/node-types.json from
# grammar.js with the tree-sitter CLI's built-in QuickJS runtime (no Node.js).
# Needs tree-sitter CLI 0.25 or newer; set TREE_SITTER to its path if it is
# not on PATH. Consumers never need this: the generated files are committed.
set -eu
cd "$(dirname "$0")/.."
TS="${TREE_SITTER:-tree-sitter}"
"$TS" --version
sh scripts/check_vendor.sh
"$TS" generate --js-runtime native
