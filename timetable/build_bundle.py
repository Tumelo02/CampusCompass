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

    # Derive the semester/year from the timetable entries themselves so the
    # header label follows the data instead of a hardcoded string. The admin
    # Semester & year panel only writes to localStorage, so it never reaches
    # students — this is what they actually see.
    semesters, years = set(), set()
    for prog in programs_out:
        for y in prog.get("years", []):
            for entry in y.get("timetable", []):
                sem = str(entry.get("semester", "")).lstrip("0")
                if sem:
                    semesters.add(sem)
                ws = str(entry.get("week_start", ""))
                if len(ws) >= 4 and ws[:4].isdigit():
                    years.add(ws[:4])

    bundle = {
        "facultyName": idx.get("facultyName"),
        "facultyFolder": idx.get("facultyFolder"),
        "programs": programs_out,
    }

    # Only publish a label when the data agrees on one semester and one year;
    # a mixed set means the app should fall back rather than pick arbitrarily.
    if len(semesters) == 1 and len(years) == 1:
        sem = semesters.pop()
        bundle["semester"] = int(sem)
        bundle["year"] = int(years.pop())
        print(f"[ok] semester label: {bundle['semester']} / {bundle['year']}")
    else:
        print(f"[warn] mixed semester/year in data (sem={sorted(semesters)}, "
              f"years={sorted(years)}); no label published", file=sys.stderr)

    with OUT.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = OUT.stat().st_size / 1024
    print(f"[ok] wrote {OUT.name} ({size_kb:.1f} KB, {len(programs_out)} programs, {missing} missing files skipped)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
