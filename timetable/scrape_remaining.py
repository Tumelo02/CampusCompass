"""Resume scrape: only targets year files that are currently empty.

Reads the full PROGRAMS list from scrape_timetable.py, finds every
`<CODE>_Year<YY>.json` under the faculty folder that is `[]`, and scrapes
only those. Populated files are left untouched.

After scraping, it rebuilds each program's `_AllYears.json/.js`, rebuilds
the faculty-wide `AllPrograms_AllYears.json/.js`, and finally runs
`build_bundle.py` so the webapp's single-file payload is current.

Run this from CUT campus / VPN — scrape_timetable.py's reachability
check already fails otherwise.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import timedelta
from pathlib import Path

from selenium.common.exceptions import WebDriverException, TimeoutException

# Reuse the existing scraper's heavy lifting. Importing triggers the
# stdout/stderr reconfigure at module load; that's intentional.
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

# ─── Retry / Delay Configuration ───────────────────────────────────────────
MAX_RETRIES = 3          # Number of retries per week scrape
RETRY_DELAY = 30         # Seconds to wait before retrying after timeout
REQUEST_DELAY = 2        # Seconds to wait between successful requests
YEAR_DELAY = 5           # Seconds to wait between different years
DRIVER_RESTART_AFTER = 5 # Restart driver after this many consecutive failures


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def find_empty_year_files() -> list[tuple[str, str, str, int]]:
    """Return [(code, name, year_str, num_years)] for each empty year JSON."""
    targets: list[tuple[str, str, str, int]] = []
    for code, name, num_years in PROGRAMS:
        for y in range(1, num_years + 1):
            year_str = f"{y:02d}"
            path = FACULTY_FOLDER / code / f"{code}_Year{year_str}.json"
            data = _load_json(path) if path.exists() else None
            if not isinstance(data, list) or len(data) == 0:
                targets.append((code, name, year_str, num_years))
    return targets


def scrape_week_with_retry(driver, dt, resource_filter: str, max_retries: int = MAX_RETRIES) -> tuple[list[dict], bool]:
    """
    Attempt to scrape a week with retries on timeout.
    Returns (entries, success_flag).
    """
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            entries = scrape_week(driver, dt, resource_filter=resource_filter)
            time.sleep(REQUEST_DELAY)  # Polite delay between requests
            return entries, True
        except (WebDriverException, TimeoutException) as e:
            last_error = e
            error_msg = str(e)
            if "ERR_CONNECTION_TIMED_OUT" in error_msg or "TimeoutException" in error_msg:
                if attempt < max_retries:
                    print(f"\n      [Timeout] Retry {attempt}/{max_retries} in {RETRY_DELAY}s...", end=" ", flush=True)
                    time.sleep(RETRY_DELAY)
                else:
                    print(f"\n      [Timeout] All {max_retries} attempts failed.")
            elif "ERR_CONNECTION_RESET" in error_msg or "ConnectionResetError" in error_msg:
                if attempt < max_retries:
                    print(f"\n      [Connection Reset] Retry {attempt}/{max_retries} in {RETRY_DELAY * 2}s...", end=" ", flush=True)
                    time.sleep(RETRY_DELAY * 2)
                else:
                    print(f"\n      [Connection Reset] All {max_retries} attempts failed.")
            else:
                # Unknown error - don't retry
                raise
        except Exception as e:
            # Non-network error - don't retry
            raise
    
    return [], False


def scrape_year(driver, code: str, name: str, year_str: str) -> tuple[list[dict], int]:
    """
    Scrape all 3 groups × WEEKS_TO_SCRAPE weeks for one program-year.
    Returns (entries, failure_count).
    """
    entries: list[dict] = []
    total_failures = 0
    
    for group_num in range(1, 4):
        group_str = str(group_num)
        group_label = f"#{code}|{SEMESTER}|{group_str}"
        fid_param = encode_group_id(code, SEMESTER, group_str)
        print(f"    Group {group_num} ({group_label})...", end=" ", flush=True)
        
        group_entries: list[dict] = []
        group_failures = 0
        
        for week in range(WEEKS_TO_SCRAPE):
            dt = START_DATE + timedelta(weeks=week)
            week_entries, success = scrape_week_with_retry(driver, dt, resource_filter=fid_param)
            
            if success:
                for e in week_entries:
                    e["group"] = group_label
                    e["program"] = code
                    e["program_name"] = name
                    e["year"] = year_str
                    e["semester"] = SEMESTER
                group_entries.extend(week_entries)
            else:
                group_failures += 1
                total_failures += 1
        
        group_entries = deduplicate_entries(group_entries)
        entries.extend(group_entries)
        
        if group_failures > 0:
            print(f"{len(group_entries)} entries ({group_failures} week(s) failed)")
        else:
            print(f"{len(group_entries)} entries")
    
    return deduplicate_entries(entries), total_failures


def save_year(code: str, year_str: str, entries: list[dict]) -> None:
    folder = FACULTY_FOLDER / code
    folder.mkdir(exist_ok=True, parents=True)
    year_json = folder / f"{code}_Year{year_str}.json"
    year_json.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  [OK] Saved {year_json.name} ({len(entries)} entries)")


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


def rebuild_faculty_all(all_program_entries: list[dict]) -> None:
    merged = deduplicate_entries(all_program_entries)
    (FACULTY_FOLDER / "AllPrograms_AllYears.json").write_text(
        json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\n[OK] Faculty combined file: {len(merged)} unique entries")


def run_bundle_builder() -> None:
    script = HERE / "build_bundle.py"
    if not script.exists():
        print("[warn] build_bundle.py not found; skipping bundle rebuild")
        return
    print("\n[*] Rebuilding timetable/bundle.json...")
    result = subprocess.run([sys.executable, str(script)], cwd=str(HERE))
    if result.returncode != 0:
        print(f"[warn] build_bundle.py exited with code {result.returncode}")


def test_connection(driver) -> bool:
    """Test if we can reach the timetable server."""
    try:
        # Try to load a simple page or the base URL
        driver.set_page_load_timeout(30)
        driver.get("https://www.google.com")  # Or your timetable base URL
        return True
    except Exception as e:
        print(f"[Connection Test Failed] {e}")
        return False


def main() -> int:
    targets = find_empty_year_files()
    if not targets:
        print("[ok] All year files already populated. Nothing to scrape.")
        run_bundle_builder()
        return 0

    print(f"Found {len(targets)} empty year-file(s) to scrape:")
    for code, _name, year_str, _ in targets:
        print(f"  - {code}_Year{year_str}")
    print()

    driver = get_driver()
    
    # Set longer page load timeout
    try:
        driver.set_page_load_timeout(120)  # 2 minutes
    except Exception:
        pass
    
    # Test connection first
    print("[*] Testing connection...")
    if not test_connection(driver):
        print("\n[ERROR] Cannot reach the server. Please check:")
        print("  1. Your internet connection")
        print("  2. VPN connection (if required)")
        print("  3. Whether the timetable server is online")
        driver.quit()
        return 1
    print("[OK] Connection test passed.\n")
    
    touched_programs: dict[str, int] = {}  # code -> num_years
    consecutive_failures = 0
    skipped_years: list[tuple[str, str]] = []
    
    try:
        for idx, (code, name, year_str, num_years) in enumerate(targets, 1):
            print(f"\n[{idx}/{len(targets)}] {code} Year {year_str} ({name})")
            
            # Check if we need to restart driver due to too many failures
            if consecutive_failures >= DRIVER_RESTART_AFTER:
                print(f"\n[!] {consecutive_failures} consecutive failures. Restarting browser...")
                try:
                    driver.quit()
                except Exception:
                    pass
                time.sleep(10)
                driver = get_driver()
                try:
                    driver.set_page_load_timeout(120)
                except Exception:
                    pass
                consecutive_failures = 0
                print("[OK] Browser restarted.\n")
            
            try:
                entries, failures = scrape_year(driver, code, name, year_str)
                
                if failures > 0:
                    consecutive_failures += 1
                    print(f"  [WARN] {failures} week(s) could not be scraped")
                else:
                    consecutive_failures = 0
                
                # Only save if we got some entries
                if entries:
                    save_year(code, year_str, entries)
                    touched_programs[code] = num_years
                else:
                    print(f"  [SKIP] No entries retrieved for {code} Year {year_str}")
                    skipped_years.append((code, year_str))
                
                # Delay between years
                time.sleep(YEAR_DELAY)
                
            except KeyboardInterrupt:
                print("\n\n[!] Interrupted by user. Saving progress...")
                break
            except Exception as e:
                print(f"  [ERROR] {code} Year {year_str}: {e}")
                import traceback
                traceback.print_exc()
                consecutive_failures += 1
                skipped_years.append((code, year_str))
                continue
                
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # Report skipped years
    if skipped_years:
        print(f"\n[!] {len(skipped_years)} year(s) could not be scraped:")
        for code, year_str in skipped_years:
            print(f"  - {code}_Year{year_str}")

    # Rebuild AllYears per touched program, then faculty-wide combined.
    if touched_programs:
        print("\n[*] Rebuilding combined files...")
        faculty_combined: list[dict] = []
        for code, num_years in touched_programs.items():
            combined = rebuild_program_allyears(code, num_years)
            faculty_combined.extend(combined)
            print(f"  [OK] Rebuilt {code}_AllYears ({len(combined)} entries)")
        
        # Also re-read untouched programs so the faculty file stays accurate.
        for code, _name, num_years in PROGRAMS:
            if code in touched_programs:
                continue
            path = FACULTY_FOLDER / code / f"{code}_AllYears.json"
            data = _load_json(path)
            if isinstance(data, list):
                faculty_combined.extend(data)

        rebuild_faculty_all(faculty_combined)
    
    run_bundle_builder()
    
    if skipped_years:
        print(f"\n[!] Run this script again to retry the {len(skipped_years)} failed year(s).")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())