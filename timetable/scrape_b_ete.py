"""Focused scraper for B_ETE Year 3 only.

B_ETE Years 1 and 2 already have data; only `B_ETE_Year03.json` is empty.
This script scrapes that single year (3 groups × WEEKS_TO_SCRAPE weeks),
rebuilds `B_ETE_AllYears.json` and the faculty-wide
`AllPrograms_AllYears.json`, then runs `build_bundle.py`.

Must be run from CUT campus / VPN — the site is otherwise unreachable.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

from scrape_timetable import (
    FACULTY_FOLDER,
    PROGRAMS,
    START_DATE,
    WEEKS_TO_SCRAPE,
    deduplicate_entries,
    encode_group_id,
    get_driver,
    scrape_week,
)

HERE = Path(__file__).resolve().parent
SEMESTER = "01"
TARGET_CODE = "B_ETE"
TARGET_YEAR = "03"


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def scrape_year(driver, code: str, name: str, year_str: str) -> list[dict]:
    entries: list[dict] = []
    for group_num in range(1, 4):
        group_str = str(group_num)
        group_label = f"#{code}|{SEMESTER}|{group_str}"
        fid_param = encode_group_id(code, SEMESTER, group_str)
        print(f"  Group {group_num} ({group_label})...", flush=True)
        group_entries: list[dict] = []
        for week in range(WEEKS_TO_SCRAPE):
            dt = START_DATE + timedelta(weeks=week)
            week_entries = scrape_week(driver, dt, resource_filter=fid_param)
            for e in week_entries:
                e["group"] = group_label
                e["program"] = code
                e["program_name"] = name
                e["year"] = year_str
                e["semester"] = SEMESTER
            group_entries.extend(week_entries)
        group_entries = deduplicate_entries(group_entries)
        entries.extend(group_entries)
        print(f"    {len(group_entries)} entries")
    return deduplicate_entries(entries)


def rebuild_program_allyears(code: str, num_years: int) -> list[dict]:
    combined: list[dict] = []
    for y in range(1, num_years + 1):
        path = FACULTY_FOLDER / code / f"{code}_Year{y:02d}.json"
        data = _load_json(path)
        if isinstance(data, list):
            combined.extend(data)
    combined = deduplicate_entries(combined)
    (FACULTY_FOLDER / code / f"{code}_AllYears.json").write_text(
        json.dumps(combined, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return combined


def rebuild_faculty_all() -> None:
    merged: list[dict] = []
    for code, _name, _num in PROGRAMS:
        data = _load_json(FACULTY_FOLDER / code / f"{code}_AllYears.json")
        if isinstance(data, list):
            merged.extend(data)
    merged = deduplicate_entries(merged)
    (FACULTY_FOLDER / "AllPrograms_AllYears.json").write_text(
        json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[OK] Faculty combined: {len(merged)} unique entries")


def run_bundle_builder() -> None:
    script = HERE / "build_bundle.py"
    if not script.exists():
        print("[warn] build_bundle.py not found; skipping")
        return
    print("\n[*] Rebuilding timetable/bundle.json...")
    subprocess.run([sys.executable, str(script)], cwd=str(HERE))


def main() -> int:
    target = FACULTY_FOLDER / TARGET_CODE / f"{TARGET_CODE}_Year{TARGET_YEAR}.json"
    existing = _load_json(target) if target.exists() else None
    if isinstance(existing, list) and len(existing) > 0:
        print(f"[ok] {target.name} already has {len(existing)} entries. Nothing to do.")
        run_bundle_builder()
        return 0

    program = next((p for p in PROGRAMS if p[0] == TARGET_CODE), None)
    if program is None:
        print(f"[error] {TARGET_CODE} not found in PROGRAMS list")
        return 1
    code, name, num_years = program

    print(f"Scraping {code} Year {TARGET_YEAR} ({name})...")
    driver = get_driver()
    try:
        entries = scrape_year(driver, code, name, TARGET_YEAR)
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    target.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] Saved {target.name} ({len(entries)} entries)")

    combined = rebuild_program_allyears(code, num_years)
    print(f"[OK] Rebuilt {code}_AllYears ({len(combined)} entries)")
    rebuild_faculty_all()
    run_bundle_builder()
    return 0


if __name__ == "__main__":
    sys.exit(main())
