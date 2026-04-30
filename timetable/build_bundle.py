#!/usr/bin/env python3
"""Combine index.json + every timetable/lecturers file into a single bundle.json.

Run whenever timetable data changes. The webapp reads bundle.json in one request
instead of ~50 separate fetches, which is drastically faster over dev tunnels
and Python's single-threaded http.server.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
INDEX = HERE / "index.json"
OUT = HERE / "bundle.json"


def load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"[warn] bad JSON in {path.relative_to(HERE)}: {e}", file=sys.stderr)
        return None


def main() -> int:
    idx = load_json(INDEX)
    if not idx:
        print(f"[error] could not read {INDEX}", file=sys.stderr)
        return 1

    programs_out = []
    missing = 0
    for prog in idx.get("programs", []):
        prog_out = {
            "code": prog.get("code"),
            "name": prog.get("name"),
            "folder": prog.get("folder"),
            "lecturers": {},
            "years": [],
        }

        lec_rel = prog.get("lecturers")
        if lec_rel:
            lec_data = load_json(HERE / lec_rel)
            if lec_data is None:
                missing += 1
            else:
                prog_out["lecturers"] = lec_data

        for y in prog.get("years", []):
            tt_rel = y.get("timetable")
            if not tt_rel:
                continue
            tt_data = load_json(HERE / tt_rel)
            if tt_data is None:
                missing += 1
                tt_data = []
            prog_out["years"].append({"year": y.get("year"), "timetable": tt_data})

        programs_out.append(prog_out)

    bundle = {
        "facultyName": idx.get("facultyName"),
        "facultyFolder": idx.get("facultyFolder"),
        "programs": programs_out,
    }

    with OUT.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = OUT.stat().st_size / 1024
    print(f"[ok] wrote {OUT.name} ({size_kb:.1f} KB, {len(programs_out)} programs, {missing} missing files skipped)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
