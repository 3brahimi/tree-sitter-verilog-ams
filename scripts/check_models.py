"""Parse Verilog-A/AMS files and report ERROR/MISSING node statistics.

Usage:
    python scripts/check_models.py [--json OUT] [--verbose] PATH...

Each PATH is a file or a directory (searched for .va, .vams, .inc, .include,
.vh). Needs the tree_sitter_verilog_ams package and py-tree-sitter >= 0.25.
The grammar has no preprocessor, so `include files are not expanded and
macros stay unexpanded text-macro usages.

Reported per group (model files, include fragments):
  files_with_errors  files whose tree has at least one ERROR or MISSING node
  error_nodes        ERROR plus MISSING nodes (outermost ones only)
  error_bytes        bytes covered by outermost ERROR nodes / total bytes
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import tree_sitter_verilog_ams
from tree_sitter import Language, Node, Parser

MODEL_SUFFIXES = {".va", ".vams"}
INCLUDE_SUFFIXES = {".inc", ".include", ".vh"}


@dataclass(frozen=True)
class FileResult:
    path: str
    group: str
    lines: int
    size: int
    error_nodes: int
    missing_nodes: int
    error_bytes: int
    first_error_line: int | None


def collect(paths: list[str]) -> list[Path]:
    found: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            found.extend(
                p for p in sorted(path.rglob("*"))
                if p.is_file() and p.suffix in MODEL_SUFFIXES | INCLUDE_SUFFIXES
            )
        elif path.is_file():
            found.append(path)
        else:
            raise FileNotFoundError(f"no such file or directory: {raw}")
    return found


def outer_errors(root: Node) -> tuple[list[Node], list[Node]]:
    """Outermost ERROR nodes and all MISSING nodes."""
    errors: list[Node] = []
    missing: list[Node] = []
    stack = [root]
    while stack:
        node = stack.pop()
        if node.is_missing:
            missing.append(node)
            continue
        if node.is_error:
            errors.append(node)
            continue
        if node.has_error:
            stack.extend(node.children)
    return errors, missing


def check_file(parser: Parser, path: Path) -> FileResult:
    data = path.read_bytes()
    tree = parser.parse(data)
    errors, missing = outer_errors(tree.root_node)
    first = min((n.start_point[0] + 1 for n in errors + missing), default=None)
    return FileResult(
        path=str(path),
        group="model" if path.suffix in MODEL_SUFFIXES else "include",
        lines=data.count(b"\n") + (0 if data.endswith(b"\n") else 1),
        size=len(data),
        error_nodes=len(errors),
        missing_nodes=len(missing),
        error_bytes=sum(n.end_byte - n.start_byte for n in errors),
        first_error_line=first,
    )


def summarize(results: list[FileResult]) -> dict[str, float | int]:
    files = len(results)
    bad = sum(1 for r in results if r.error_nodes or r.missing_nodes)
    lines = sum(r.lines for r in results)
    size = sum(r.size for r in results)
    nodes = sum(r.error_nodes + r.missing_nodes for r in results)
    err_bytes = sum(r.error_bytes for r in results)
    return {
        "files": files,
        "files_with_errors": bad,
        "file_error_rate": round(bad / files, 4) if files else 0.0,
        "lines": lines,
        "error_nodes": nodes,
        "error_nodes_per_kloc": round(1000 * nodes / lines, 3) if lines else 0.0,
        "bytes": size,
        "error_byte_fraction": round(err_bytes / size, 5) if size else 0.0,
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--json", help="write per-file results and summary to this file")
    ap.add_argument("--verbose", action="store_true", help="list every file with errors")
    args = ap.parse_args(argv)

    try:
        files = collect(args.paths)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if not files:
        print("error: no Verilog-A/AMS files found", file=sys.stderr)
        return 2

    parser = Parser(Language(tree_sitter_verilog_ams.language()))
    results = [check_file(parser, f) for f in files]
    summary = {
        group: summarize([r for r in results if r.group == group])
        for group in ("model", "include")
    }
    for group, stats in summary.items():
        print(f"{group}: " + ", ".join(f"{k}={v}" for k, v in stats.items()))
    if args.verbose:
        for r in results:
            if r.error_nodes or r.missing_nodes:
                print(f"  {r.path}: {r.error_nodes} ERROR, {r.missing_nodes} MISSING, "
                      f"first at line {r.first_error_line}")
    if args.json:
        Path(args.json).write_text(json.dumps(
            {"summary": summary, "files": [asdict(r) for r in results]}, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
