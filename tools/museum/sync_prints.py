"""Resolve the curated list and report what would render.

T-03 implements the dry-run. The full run (render, mirror, deploy) lands in T-08.
"""
from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path

import rijks

HERE = Path(__file__).resolve().parent
DEFAULT_LIST = HERE / "prints.toml"
DEFAULT_CACHE = HERE / ".cache"


def load_list(path: Path) -> list[str]:
    data = tomllib.loads(Path(path).read_text())
    return list(data.get("prints", []))


def run(list_path: Path, fetch, out=print) -> list[rijks.Print | rijks.Skip]:
    results: list[rijks.Print | rijks.Skip] = []
    for number in load_list(list_path):
        result = rijks.resolve(number, fetch)
        results.append(result)
        if isinstance(result, rijks.Skip):
            out(f"{number}  skip: {result.reason}")
        else:
            out(
                f"{number}  {result.type}  {result.rights}  "
                f"{result.width}x{result.height}  ok"
            )
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", type=Path, default=DEFAULT_LIST)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args(argv)

    fetcher = rijks.Fetcher(DEFAULT_CACHE, refresh=args.refresh)
    run(args.list, fetcher.get_json)

    if not args.dry_run:
        print("full run lands in T-08; use --dry-run for now", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
