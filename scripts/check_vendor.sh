#!/bin/sh
# Verify that the vendored base grammar matches the pin in
# vendor/tree-sitter-systemverilog/PIN.
set -eu
cd "$(dirname "$0")/../vendor/tree-sitter-systemverilog"
expected=$(awk -F' *= *' '$1 == "sha256" {print $2}' PIN)
actual=$(shasum -a 256 grammar.js | awk '{print $1}')
if [ "$expected" != "$actual" ]; then
  echo "vendored grammar.js does not match PIN (expected $expected, got $actual)" >&2
  exit 1
fi
echo "vendored base grammar matches PIN"
