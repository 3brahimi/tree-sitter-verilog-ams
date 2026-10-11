# Tests

Three test sets check the grammar. All three must pass before a commit that
changes `grammar.js` or `src/scanner.c`.

## 1. AMS corpus (`test/corpus/`)

`tree-sitter test` runs 43 cases, one or more for every rule this grammar
adds:

| File | Covers |
| --- | --- |
| `natures.txt` | `nature` declarations, parent natures, attributes |
| `disciplines.txt` | `discipline` declarations, `potential`/`flow` bindings, `domain`, attribute overrides, `logic` as a discipline name |
| `branches.txt` | `branch` declarations, port branches `(<p>)`, indexed terminals |
| `analog_blocks.txt` | `analog`, `analog initial`, analog blocks in generate loops, `analog function` |
| `contributions.txt` | `<+` with `V`, `I` and other access names, indirect contributions, comments around the target |
| `access_functions.txt` | `V()`/`I()` with net, branch, port and hierarchical arguments, macro node names |
| `analog_operators.txt` | `ddt`, `idt`, `idtmod`, `ddx`, `transition`, `slew`, `absdelay`, `laplace_*`, `zi_*`, `limexp`, `last_crossing`, noise and analysis functions |
| `events.txt` | `cross`, `above`, `timer`, `initial_step`, `final_step`, `or` combinations |
| `connect.txt` | `connectmodule`, `connectrules`, `connect` insertion and resolution statements |
| `nets.txt` | `wreal`, `ground` |
| `numbers.txt` | scale-factor literals, and time literals that must keep their SystemVerilog parse |
| `parameters.txt` | `from`/`exclude` ranges, `inf`, `aliasparam`, attributes, a parameter named `type` |
| `paramsets.txt` | `paramset` with `.param = value;` statements |
| `system_functions.txt` | `$abstime`, `$vt`, `$temperature`, `$simparam`, `$param_given`, `$port_connected`, `$bound_step`, `$discontinuity`, `$limit`, `$mfactor` |
| `sv_compat.txt` | AMS words used as SystemVerilog identifiers, task calls named `V`/`I` |

## 2. Base SystemVerilog corpus

`scripts/run_base_corpus.sh` runs the corpus of the base grammar
(gmlarumbe/tree-sitter-systemverilog-test at the commit pinned in
`vendor/tree-sitter-systemverilog/PIN`, 2989 cases) against this grammar.
Every case must give the same tree as the base grammar. Current result:
2989 of 2989 pass, the same as the unmodified base generated with the same CLI.

## 3. Real Verilog-A/AMS models (`test/models/`)

`scripts/check_models.py test/models` parses open models and reports
ERROR/MISSING nodes. Only permissively licensed files were collected; the
license of every file was checked from its own header first and the repository
license second. `test/models/manifest.json` records source, commit, upstream
path, license and the evidence for each file.

Files under MIT, MIT-0 or Apache-2.0 are committed here, with the license text
of their source next to them. Files under ECL-2.0, the BSIM/CMC-style licenses
(royalty-free, modify and redistribute with attribution, no charge for the
code itself) or the Mextram license allow redistribution but are not plain
permissive licenses, so they are not committed. `scripts/fetch_models.py`
downloads them at the pinned commits into `test/models/.fetched/`
(git-ignored).

| Source | Commit | License | Files | Committed |
| --- | --- | --- | --- | --- |
| [IHP-GmbH/IHP-Open-PDK](https://github.com/IHP-GmbH/IHP-Open-PDK) | `5e6d592e4002` | Apache-2.0 | 18 | yes |
| [OmarSiwy/VerA](https://github.com/OmarSiwy/VerA) | `67f797d13051` | Apache-2.0 | 47 | yes |
| [SahraEbm/GaN-HEMT-GFP-SFP-VerilogA](https://github.com/SahraEbm/GaN-HEMT-GFP-SFP-VerilogA) | `a6f18df5c1ae` | MIT | 2 | yes |
| [SahraEbm/GaN-HEMT-GFP-VerilogA](https://github.com/SahraEbm/GaN-HEMT-GFP-VerilogA) | `7ddbc69a85ca` | MIT | 6 | yes |
| [ShabbyGayBar/verilogaLib](https://github.com/ShabbyGayBar/verilogaLib) | `a6cdb37055a8` | MIT | 7 | yes |
| [YJ-Guan/VerilogA-Voltage_Controll_Oscillator](https://github.com/YJ-Guan/VerilogA-Voltage_Controll_Oscillator) | `b8151ddc33c0` | MIT | 1 | yes |
| [chiara-rossi/CompactModel_P-modulated-Schottky-junction](https://github.com/chiara-rossi/CompactModel_P-modulated-Schottky-junction) | `ba89d07cb46f` | MIT | 2 | yes |
| [dwarning/VA-Models](https://github.com/dwarning/VA-Models) | `6099b4e12e6f` | MIT (file header) | 2 | yes |
| [j1s1e1/veriloga_examples](https://github.com/j1s1e1/veriloga_examples) | `b1bba4228d26` | MIT | 4 | yes |
| [joaln27/devphys](https://github.com/joaln27/devphys) | `bcae3beebcaa` | Apache-2.0 | 1 | yes |
| [jurjsorinliviu/Psi-Vortex](https://github.com/jurjsorinliviu/Psi-Vortex) | `28925f2ba193` | MIT | 1 | yes |
| [mikprin/verilogA](https://github.com/mikprin/verilogA) | `832e830fc6b8` | MIT | 3 | yes |
| [numano1/mnist_veriloga](https://github.com/numano1/mnist_veriloga) | `de328a7bd93f` | MIT | 12 | yes |
| [phgrove/ams_util](https://github.com/phgrove/ams_util) | `03d97ecfe301` | MIT-0 | 5 | yes |
| [rajinthanr/pll-ihp-sg13g2](https://github.com/rajinthanr/pll-ihp-sg13g2) | `ca2c7e529e60` | MIT | 1 | yes |
| [IHP-GmbH/IHP-Open-PDK](https://github.com/IHP-GmbH/IHP-Open-PDK) | `5e6d592e4002` | BSIM/CMC-style | 3 | no (fetched) |
| [SahraEbm/GaN-HEMT-GFP-SFP-VerilogA](https://github.com/SahraEbm/GaN-HEMT-GFP-SFP-VerilogA) | `a6f18df5c1ae` | BSIM/CMC-style | 1 | no (fetched) |
| [SahraEbm/GaN-HEMT-GFP-VerilogA](https://github.com/SahraEbm/GaN-HEMT-GFP-VerilogA) | `7ddbc69a85ca` | BSIM/CMC-style | 1 | no (fetched) |
| [dwarning/VA-Models](https://github.com/dwarning/VA-Models) | `6099b4e12e6f` | BSIM/CMC-style | 25 | no (fetched) |
| [dwarning/VA-Models](https://github.com/dwarning/VA-Models) | `6099b4e12e6f` | ECL-2.0 | 76 | no (fetched) |
| [dwarning/VA-Models](https://github.com/dwarning/VA-Models) | `6099b4e12e6f` | Mextram IP license | 14 | no (fetched) |

Left out entirely (not collected): the Accellera `disciplines.vams` and
`constants.vams` headers (their notice requires permission for other uses),
the PSP 102/103/104 and IHP psp103/juncap files (copyright notice with no
grant), files with no license or "all rights reserved" (vbic, hicum2 L2,
fbh_hbt, bsim4), files whose headers contradict themselves (ekv, ekv3, the
angelov `compact.vams`), and GPL/AGPL files (VA-Models `igbt3.va`, the IHP
gnucap `capacitor.va` files). As a result `include` lines for the Accellera
headers do not resolve; the grammar has no preprocessor, so this does not
change parsing.

### Results

232 files: 161 model files (`.va`, `.vams`) and 71 include fragments
(`.inc`, `.include`, `.vh`, which are not standalone units).

| Set | Files | Files with errors | ERROR+MISSING nodes | Nodes per kLOC | Bytes in ERROR nodes |
| --- | --- | --- | --- | --- | --- |
| All model files | 161 | 41 (25.5%) | 1718 | 18.7 | 16.3% |
| All model files except the 6 worst | 155 | 35 (22.6%) | 278 | 3.9 | 0.2% |
| Committed model files | 109 | 14 (12.8%) | 667 | 46.8 | 0.7% |
| Include fragments | 71 | 26 (36.6%) | 481 | 10.4 | 0.8% |

Three files account for 97% of the bytes inside ERROR nodes: `bsimsoi.va` and
`BSIM6.1.1.va` wrap the module header in `` `ifdef `` blocks, which turns the
whole module into one ERROR node, and `HEMT_With_GFPSFP.va` loses its module
after an earlier error.

The remaining errors come from the base grammar or from preprocessing, not
from missing AMS rules:

- unary `-` or `+` directly before a macro, such as `x < -`EXPL_THRESHOLD`
  (the base grammar rejects this in SystemVerilog too): 20 model files;
- `` `ifdef `` blocks around module headers or declarations: 14 files;
- macros used as whole parameter declarations or as attribute lists, such as
  `` `MPRco(...) `` or `` parameter real x = 1 `P(info="...") ``: 6 files;
- gnucap-specific syntax in the IHP gnucap models (`` `pragma modelgen ``,
  `.LEVEL = 103.8.2`): 6 files;
- typos in the source (`2uc`, a cut line in `hemt_extrinsic_diodes.va`) and
  a port named `ref`, which is still the SystemVerilog `ref` direction
  keyword inside port lists: 3 files.
