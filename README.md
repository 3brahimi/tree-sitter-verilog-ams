# tree-sitter-verilog-ams

A [tree-sitter](https://tree-sitter.github.io/) grammar for Verilog-AMS and
Verilog-A. It extends
[tree-sitter-systemverilog](https://github.com/gmlarumbe/tree-sitter-systemverilog)
through grammar inheritance, the way tree-sitter-cpp extends tree-sitter-c:
`grammar.js` loads the base grammar with `require` and calls
`grammar(base, {...})`, adding only Verilog-AMS rules. Pure SystemVerilog
parses exactly as it does with the base grammar.

The base grammar is vendored unmodified in `vendor/tree-sitter-systemverilog/`
at tag v0.3.1 (commit `e88937e`), the version hdl-kgraph uses. `PIN` records
the source and checksum.

## Install and use (Python)

```sh
pip install "/path/to/tree-sitter-verilog-ams[core]"   # not published on PyPI
```

```python
import tree_sitter_verilog_ams
from tree_sitter import Language, Parser

parser = Parser(Language(tree_sitter_verilog_ams.language()))
tree = parser.parse(b"module r(p, n); electrical p, n; analog I(p, n) <+ V(p, n) / 1k; endmodule")
```

Needs py-tree-sitter 0.25 or newer (the parser is ABI 15). The generated
parser is committed, so installing compiles C only: no Node.js and no
tree-sitter CLI.

## What the grammar adds

Clause numbers refer to the Accellera Verilog-AMS LRM 2.4.

| Construct | Nodes | LRM |
| --- | --- | --- |
| `nature ... endnature` | `nature_declaration`, `parent_nature`, `nature_attribute` | 3.6.1 |
| `discipline ... enddiscipline` | `discipline_declaration`, `nature_binding`, `discipline_domain_binding`, `nature_attribute_override` | 3.6.2 |
| `ground` | `ground_declaration` | 3.6.4 |
| `wreal` | `net_type` | 3.7 |
| parameter ranges `from`/`exclude`, `inf` | `parameter_value_range`, `infinity` | 3.4.2 |
| `aliasparam` | `aliasparam_declaration` | 3.4.7 |
| `branch (a, b) br;`, port branches `(<p>)` | `branch_declaration`, `branch_terminal` | 3.12 |
| access functions `V(a)`, `V(a, b)`, `I(br)`, `I(<p>)` | `branch_probe` | 4.4 |
| `ddt`, `ddx`, `idt`, `idtmod`, `absdelay`, `transition`, `slew`, `last_crossing`, `laplace_nd/np/zd/zp`, `zi_nd/np/zd/zp`, `limexp` | `analog_operator_call` | 4.5 |
| `analysis`, `ac_stim`, `white_noise`, `flicker_noise`, `noise_table`, `noise_table_log` | `analog_operator_call` | 4.6 |
| `analog function` | `analog_function_declaration` | 4.7 |
| `analog`, `analog initial` | `analog_construct` | 5.2 |
| `<+` contributions, indirect `V(out) : V(in) == 0;` | `contribution_statement`, `indirect_contribution_statement` | 5.6 |
| `cross`, `above`, `timer`, `initial_step`, `final_step` | `analog_event_function` | 5.10 |
| `paramset ... endparamset` | `paramset_declaration`, `paramset_statement` | 6.4 |
| `connectmodule` | `module_keyword` | 7.5, 7.6 |
| `connectrules`, `connect ... [merged\|split]`, `connect ... resolveto` | `connectrules_declaration`, `connect_insertion`, `connect_resolution` | 7.7 |
| scale factors `1k`, `10n`, `2.5u` | `scaled_real_number` | 2.6.2 |
| analog `$` functions (`$abstime`, `$vt`, `$temperature`, `$simparam`, `$limit`, `$bound_step`, ...) | `analog_system_tf_call` | 9 |

`analog function` and parameter ranges and aliases are not in the original
request list, but nearly every real model uses them.

## Design notes

- **Context-sensitive names.** Many AMS words (`transition`, `timer`,
  `above`, `analysis`, `V`) are common SystemVerilog identifiers. A small
  external scanner (`src/scanner.c`) emits the analog operator, event and
  `V`/`I` tokens only when the name is followed by `(`, so `timer <= timer + 1`
  still parses as SystemVerilog. Other AMS keywords are contextual keywords:
  they are keywords only where AMS syntax expects them.
- **Contribution targets.** At the start of a statement the scanner looks
  past the balanced `( ... )` after a name; only if `<+` or a single `:`
  follows does it start a contribution. This accepts any access name
  (`Pwr(a) <+ x;`) without parser-level ambiguity, and `V(a);` stays a task
  call.
- **Scale factors** need one character of lookahead: `1n` is a scaled real but
  `1ns` stays a SystemVerilog time literal.
- **`type`, `ref`, `iff`** are reserved in SystemVerilog but are not
  Verilog-AMS keywords (LRM Annex B). They are no longer reserved everywhere,
  and a bare `type` can be a value, so compact models with a `type` parameter
  and `(* type = "instance" *)` attributes parse. `logic` is accepted as a
  discipline name.
- **No preprocessor.** As in the base grammar, `` `include `` is not expanded
  and `` `ifdef `` is parsed as text in place. Macros used as node names in
  access functions and branches are accepted.

## Tests

See [test/README.md](test/README.md). In short:

- AMS corpus: 43 of 43 pass (`tree-sitter test`).
- Base SystemVerilog corpus: 2989 of 2989 pass, the same as the base grammar
  (`scripts/run_base_corpus.sh`).
- 161 open Verilog-A model files: 120 parse without errors; 18.7 error nodes
  per 1000 lines; the remaining errors come from preprocessing and base
  grammar limits (`scripts/check_models.py`).

## Regenerating the parser

Only needed after changing `grammar.js`. Use tree-sitter CLI 0.25 or newer
with its built-in QuickJS runtime; Node.js is not needed:

```sh
TREE_SITTER=/path/to/tree-sitter sh scripts/generate.sh   # tree-sitter generate --js-runtime native
tree-sitter test
TREE_SITTER=/path/to/tree-sitter sh scripts/run_base_corpus.sh
```

The committed parser was generated with tree-sitter CLI 0.27.1 (QuickJS).

## Commercial use

Noncommercial use is free under the PolyForm Noncommercial License 1.0.0
(see [LICENSE](LICENSE)). Any commercial use needs a separate license from
the author:

1. Open an issue with the
   [Commercial license request](../../issues/new?template=commercial-license.yml)
   template, or email masoud.ebrahimi@formaltrust.ai if you prefer not to post in public.
2. The author grants a commercial license by replying on that issue (or by
   email), naming the licensee, the product and the terms.

Versions tagged before v0.2.0 were released under the MIT License and stay
available under it.

## License

PolyForm Noncommercial 1.0.0, see [LICENSE](LICENSE). The vendored base grammar is MIT,
Copyright (c) 2024-2025 Gonzalo M. Larumbe; see [NOTICE](NOTICE) and
`vendor/tree-sitter-systemverilog/LICENSE`. Test models keep their own
licenses, listed in [test/README.md](test/README.md).
