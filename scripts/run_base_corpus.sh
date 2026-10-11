#!/bin/sh
# Run the base grammar's own SystemVerilog corpus against this grammar, to
# check that pure SystemVerilog parses exactly as it does with the base.
#
# Usage: scripts/run_base_corpus.sh [WORKDIR]
# Clones gmlarumbe/tree-sitter-systemverilog-test at the commit pinned in
# vendor/tree-sitter-systemverilog/PIN (corpus only) into WORKDIR (default:
# a temporary directory), builds the parser and runs `tree-sitter test` on it.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TS="${TREE_SITTER:-tree-sitter}"
PIN="$ROOT/vendor/tree-sitter-systemverilog/PIN"
url=$(awk -F' *= *' '$1 == "test" {print $2}' "$PIN")
commit=$(awk -F' *= *' '$1 == "test_commit" {print $2}' "$PIN")
WORK="${1:-$(mktemp -d)}"

if [ ! -d "$WORK/sv-test/.git" ]; then
  git clone -q --filter=blob:none --no-checkout "$url" "$WORK/sv-test"
  git -C "$WORK/sv-test" sparse-checkout set corpus
fi
git -C "$WORK/sv-test" checkout -q "$commit"

mkdir -p "$WORK/run/test"
cp "$ROOT/tree-sitter.json" "$WORK/run/"
ln -sfn "$ROOT/src" "$WORK/run/src"
ln -sfn "$WORK/sv-test/corpus" "$WORK/run/test/corpus"
"$TS" build -o "$WORK/verilog_ams.so" "$ROOT"
cd "$WORK/run"
"$TS" test --lib-path "$WORK/verilog_ams.so" --lang-name verilog_ams --overview-only
