"""
Scrape CUT (Central University of Technology) timetable - all courses and lectures.
Target: CELCAT Calendar at timetable.cut.ac.za/BLOEM_CALENDAR.
Exports: JSON and a JS file (timetable_data.js) for frontend use.
"""

import json
import re
import time
import sys
from datetime import datetime, timedelta
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

# #region agent log
# Log file path relative to script location
DEBUG_LOG_PATH = Path(__file__).parent / "debug-1f5f60.log"

# Safe print function that handles encoding errors
def safe_print(*args, **kwargs):
    """Print function that handles Unicode encoding errors gracefully."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        # Fallback: encode to ASCII, replacing non-ASCII with ?
        try:
            encoded_args = []
            for arg in args:
                if isinstance(arg, str):
                    encoded_args.append(arg.encode('ascii', errors='replace').decode('ascii'))
                else:
                    encoded_args.append(str(arg).encode('ascii', errors='replace').decode('ascii'))
            print(*encoded_args, **kwargs)
        except Exception:
            # Last resort: just print the string representation
            print(str(args).encode('ascii', errors='replace').decode('ascii'))

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    try:
        original_stdout_encoding = sys.stdout.encoding
        original_stderr_encoding = sys.stderr.encoding
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
        # Use regular print after successful reconfigure
        _print = print
        try:
            with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
                import json as j
                logf.write(j.dumps({"sessionId":"1f5f60","runId":"encoding-fix","hypothesisId":"A","location":"scrape_timetable.py:48","message":"Console encoding reconfigured","data":{"original_stdout":original_stdout_encoding,"original_stderr":original_stderr_encoding,"new_stdout":sys.stdout.encoding,"new_stderr":sys.stderr.encoding},"timestamp":int(time.time()*1000)}) + '\n')
        except: pass
    except Exception as e:
        # If reconfigure fails, use safe_print for all output
        _print = safe_print
        try:
            with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
                import json as j
                logf.write(j.dumps({"sessionId":"1f5f60","runId":"encoding-fix","hypothesisId":"A","location":"scrape_timetable.py:56","message":"Console encoding reconfigure failed","data":{"error":str(e),"stdout_encoding":sys.stdout.encoding},"timestamp":int(time.time()*1000)}) + '\n')
        except: pass
else:
    _print = print
# #endregion

# --- Configuration ---
BASE_URL = "https://timetable.cut.ac.za/BLOEM_CALENDAR/cal"
ENTITY_TYPE = "group"
VIEW_TYPE = "listWeek"

# Faculty: Engineering, Built Environment & Information Technology
FACULTY_NAME = "Engineering_Built_Environment_Information_Technology"
FACULTY_FOLDER = Path(__file__).parent / FACULTY_NAME

# Programs: (program_code, program_name, years)
PROGRAMS = [
    ("B_ETE", "Bachelor of Engineering Technology: Electrical Engineering", 3),
    ("DP_ELE", "Diploma in Engineering Technology: Electrical Engineering", 3),
    ("B_MEC", "Bachelor of Engineering Technology: Mechanical Engineering", 3),
    ("DP_MEC", "Diploma in Engineering Technology: Mechanical Engineering", 3),
    ("B_CVLE", "Bachelor of Engineering Technology: Civil Engineering", 3),
    ("DP_CVL", "Diploma in Engineering Technology: Civil Engineering", 3),
    ("B_CQS", "Bachelor in Construction: Quantity Surveying", 3),
    ("B_CON", "Bachelor in Construction: Construction Management", 3),
    ("ITEC", "Bachelor of Information Technology", 3),
    ("DP_IT", "Diploma in Information Technology", 3),
    ("B_INF", "Bachelor of Informatics", 3),
    ("HC_CON", "Higher Certificate: Construction", 1),
    ("IEHCRE", "Higher Certificate: Renewable Energy Technologies", 1),
]

WEEKS_TO_SCRAPE = 4
START_DATE = datetime(2026, 2, 20)


def encode_group_id(program: str, semester: str, group: str) -> str:
    """Encode #PROGRAM|SEMESTER|GROUP to URL format."""
    # # becomes %23, | becomes %7C
    # Format: #PROGRAM|SEMESTER|GROUP (e.g., #B_ETE|01|1 for Semester 1, Group 1)
    # Semester is always "01" for Semester 1
    # Group is "1", "2", or "3" (not zero-padded in URL)
    encoded = f"%23{program}%7C{semester}%7C{group}"
    return f"fid0={encoded}"


def generate_resource_filters() -> list[tuple[str, str, str, str]]:
    """Generate (program_code, year, group_label, fid_param) for all programs/years/groups."""
    filters = []
    semester = "01"  # Semester 1 (constant for current extraction)
    for program_code, program_name, num_years in PROGRAMS:
        for year_num in range(1, num_years + 1):
            year_str = f"{year_num:02d}"  # 01, 02, 03 (for file naming)
            for group_num in range(1, 4):  # Groups 1, 2, 3
                group_str = str(group_num)  # "1", "2", "3" (not zero-padded)
                group_label = f"#{program_code}|{semester}|{group_str}"
                fid_param = encode_group_id(program_code, semester, group_str)
                filters.append((program_code, year_str, group_label, fid_param))
    return filters


def build_url(dt: datetime, resource_filter: str | None = None) -> str:
    date_str = dt.strftime("%Y-%m-%d")
    url = f"{BASE_URL}?vt={VIEW_TYPE}&dt={date_str}&et={ENTITY_TYPE}"
    if resource_filter:
        url += f"&{resource_filter}"
    return url


def get_driver():
    """Create Chrome WebDriver using webdriver-manager (no manual chromedriver path)."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # Remove for visible browser
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


# Day header pattern (e.g. "Mon 2/16") - not an event
DAY_HEADER_RE = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}/\d{1,2}$", re.I)
# Time slot pattern (e.g. "7am", "12pm", "all-day") - not an event by itself
TIME_SLOT_RE = re.compile(r"^(\d{1,2}(?:am|pm)|all-day)$", re.I)


def _parse_event_text(text: str) -> dict:
    """Parse multi-line event cell into course, room, lecturer."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    course = lines[0] if lines else ""
    room = ""
    lecturer = ""
    for i, ln in enumerate(lines[1:], 1):
        if not ln:
            continue
        # Heuristic: short token often room (e.g. "A101"); longer often lecturer
        if len(ln) <= 20 and not room and not re.match(r"^[A-Za-z]+\s+[A-Za-z]+", ln):
            room = ln
        elif not lecturer:
            lecturer = ln
    return {"course": course, "room": room, "lecturer": lecturer}


def extract_from_table(driver) -> list[dict]:
    """Parse calendar week grid: header row = days, first column = times, cells = events."""
    timetable_data = []
    table = None
    for table_id in ("calendarTable", "tblTimetable", "timetable", "calTable", "mainTable"):
        try:
            table = driver.find_element(By.ID, table_id)
            break
        except Exception:
            continue
    if not table:
        try:
            tables = driver.find_elements(By.TAG_NAME, "table")
            if tables:
                table = tables[0]
        except Exception:
            pass
    if not table:
        return []

    rows = table.find_elements(By.TAG_NAME, "tr")
    if len(rows) < 2:
        return []

    # First row: day headers (e.g. "", "Mon 2/16", "Tue 2/17", ...)
    header_cells = rows[0].find_elements(By.XPATH, "./td | ./th")
    day_headers = []
    for i, cell in enumerate(header_cells):
        day_headers.append(cell.text.strip())
    # If first cell is empty, day columns are 1..N; else 0..N-1
    start_col = 1 if (day_headers and DAY_HEADER_RE.match(day_headers[0])) else 0
    if not day_headers:
        return []

    # Find event elements inside the table (links, divs with event class, elements with title)
    try:
        seen_text = set()
        for el in table.find_elements(By.CSS_SELECTOR, "td a[href], td [class*='event'], td [class*='Event'], .fc-event, td [title], td div"):
            if not el.is_displayed():
                continue
            text = (el.get_attribute("title") or el.text or "").strip()
            if not text or len(text) < 3 or DAY_HEADER_RE.match(text) or TIME_SLOT_RE.match(text):
                continue
            if text in seen_text:
                continue
            seen_text.add(text)
            # Find parent td to get day and time
            parent = el
            for _ in range(5):
                try:
                    parent = parent.find_element(By.XPATH, "..")
                except Exception:
                    break
                tag = parent.tag_name.lower()
                if tag == "td" or tag == "th":
                    break
            else:
                continue
            if parent.tag_name.lower() not in ("td", "th"):
                continue
            try:
                grandparent = parent.find_element(By.XPATH, "..")
                row_index = len(grandparent.find_elements(By.XPATH, "./preceding-sibling::tr"))
                col_index = len(parent.find_elements(By.XPATH, "./preceding-sibling::td | ./preceding-sibling::th"))
            except Exception:
                row_index = col_index = 0
            day = day_headers[col_index] if col_index < len(day_headers) else ""
            time_slot = ""
            if row_index < len(rows) and row_index > 0:
                time_cells = rows[row_index].find_elements(By.XPATH, "./td | ./th")
                if time_cells:
                    time_slot = time_cells[0].text.strip()
            parsed = _parse_event_text(text)
            entry = {
                "day": day,
                "time": time_slot,
                "course": parsed["course"] or (text.split("\n")[0] if text else ""),
                "room": parsed["room"],
                "lecturer": parsed["lecturer"],
            }
            timetable_data.append(entry)
    except Exception:
        pass

    # If we got events from links/event elements, return them
    if timetable_data:
        return timetable_data

    # Fallback: scan each data cell (skip first row); treat cells with substantial text as events
    for r in range(1, len(rows)):
        cells = rows[r].find_elements(By.XPATH, "./td | ./th")
        if not cells:
            continue
        time_slot = cells[0].text.strip() if cells else ""
        for c in range(1, len(cells)):
            cell = cells[c]
            text = cell.text.strip()
            if not text or len(text) < 3:
                continue
            if DAY_HEADER_RE.match(text) or TIME_SLOT_RE.match(text):
                continue
            # Single token that looks like time only - skip
            if re.match(r"^\d{1,2}(?:am|pm)$", text, re.I):
                continue
            day = day_headers[c] if c < len(day_headers) else ""
            parsed = _parse_event_text(text)
            course = parsed["course"] or text.split("\n")[0].strip()
            if not course:
                continue
            entry = {
                "day": day,
                "time": time_slot,
                "course": course,
                "room": parsed["room"],
                "lecturer": parsed["lecturer"],
            }
            timetable_data.append(entry)

    # If still no events, save table HTML for debugging (one file per run)
    if not timetable_data and table:
        try:
            debug_path = Path(__file__).parent / "table_debug.html"
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(driver.execute_script("return arguments[0].outerHTML;", table))
            _print(f"  [Debug] No events found; table HTML saved to {debug_path}")
        except Exception:
            pass
    return timetable_data


def extract_from_list_container(driver) -> list[dict]:
    """Extract from list-style containers (e.g. divs with event classes)."""
    timetable_data = []
    # Common CELCAT / calendar class patterns
    selectors = [
        "div.event",
        "div.fc-event",
        "[class*='event']",
        "div.list-group-item",
        ".timetable-event",
        "li.event",
    ]
    for selector in selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            if not elements:
                continue
            for el in elements:
                text = el.text.strip()
                if not text or len(text) < 3:
                    continue
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                entry = {
                    "day": lines[0] if len(lines) > 0 else "",
                    "time": lines[1] if len(lines) > 1 else "",
                    "course": lines[2] if len(lines) > 2 else "",
                    "room": lines[3] if len(lines) > 3 else "",
                    "lecturer": lines[4] if len(lines) > 4 else "",
                    "raw_text": text,
                }
                timetable_data.append(entry)
            if timetable_data:
                return timetable_data
        except Exception:
            continue
    return timetable_data


def _is_real_event(entry: dict) -> bool:
    """Filter out header/structure rows (day names, time slots only, no course)."""
    course = (entry.get("course") or "").strip()
    if not course or len(course) < 2:
        return False
    if DAY_HEADER_RE.match(course) or TIME_SLOT_RE.match(course):
        return False
    # Skip if course looks like concatenated day headers (e.g. "Mon 2/16 Tue 2/17 Wed 2/18...")
    if re.search(r"Mon\s+\d{1,2}/\d{1,2}.*Tue\s+\d{1,2}/\d{1,2}", course):
        return False
    return True


def extract_from_any_structure(driver, page_date: datetime) -> list[dict]:
    """Try table (grid) first, then list-style containers. Add week context. Keep only real events."""
    data = extract_from_table(driver)
    if not data:
        data = extract_from_list_container(driver)
    data = [e for e in data if _is_real_event(e)]
    week_start = page_date.strftime("%Y-%m-%d")
    for entry in data:
        entry["week_start"] = week_start
    return data


def extract_fullcalendar_events(driver, page_date: datetime) -> list[dict]:
    """Extract from FullCalendar .fc-event elements (anywhere in document)."""
    entries = []
    try:
        # FullCalendar renders events as .fc-event; may load after initial paint
        events = driver.find_elements(By.CSS_SELECTOR, ".fc-event, .fc-event .fc-title, .fc-list-event")
        for el in events:
            if not el.is_displayed():
                continue
            text = (el.get_attribute("title") or el.text or "").strip()
            if not text or len(text) < 2:
                continue
            if DAY_HEADER_RE.match(text) or TIME_SLOT_RE.match(text):
                continue
            # Try to get time/date from parent or data attributes
            parent = el
            date_attr = ""
            for _ in range(10):
                try:
                    date_attr = parent.get_attribute("data-date") or parent.get_attribute("data-start")
                    if date_attr:
                        break
                    parent = parent.find_element(By.XPATH, "..")
                except Exception:
                    break
            parsed = _parse_event_text(text)
            entries.append({
                "day": date_attr[:10] if date_attr and len(date_attr) >= 10 else "",
                "time": date_attr[11:16] if date_attr and len(date_attr) >= 16 else "",
                "course": parsed["course"] or (text.split("\n")[0] if text else ""),
                "room": parsed["room"],
                "lecturer": parsed["lecturer"],
                "week_start": page_date.strftime("%Y-%m-%d"),
            })
    except Exception:
        pass
    return entries


def scrape_week(driver, dt: datetime, resource_filter: str | None = None, wait_timeout: int = 15) -> list[dict]:
    """Load one week view and extract all timetable entries."""
    url = build_url(dt, resource_filter)
    driver.get(url)
    try:
        WebDriverWait(driver, wait_timeout).until(
            EC.any_of(
                EC.presence_of_element_located((By.TAG_NAME, "table")),
                EC.presence_of_element_located((By.CSS_SELECTOR, "[class*='event'], [class*='list'], .fc-view")),
            )
        )
    except Exception:
        pass
    # FullCalendar loads events via AJAX; wait for .fc-event to appear
    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".fc-event")))
    except Exception:
        time.sleep(5)
    time.sleep(2)
    data = extract_fullcalendar_events(driver, dt)
    if not data:
        data = extract_from_any_structure(driver, dt)
    # If no events found, try list view then agenda week (different DOM)
    if not data and VIEW_TYPE == "listWeek":
        for alt_vt in ("list", "agendaWeek"):
            alt_url = f"{BASE_URL}?vt={alt_vt}&dt={dt.strftime('%Y-%m-%d')}&et={ENTITY_TYPE}"
            if resource_filter:
                alt_url += f"&{resource_filter}"
            driver.get(alt_url)
            time.sleep(3)
            data = extract_fullcalendar_events(driver, dt)
            if not data:
                data = extract_from_table(driver)
            if not data:
                data = extract_from_list_container(driver)
            data = [e for e in data if _is_real_event(e)]
            for e in data:
                e["week_start"] = dt.strftime("%Y-%m-%d")
            if data:
                break
    return data


def deduplicate_entries(entries: list[dict]) -> list[dict]:
    """Remove duplicate entries (same group, day, time, course, room)."""
    seen = set()
    out = []
    for e in entries:
        key = (e.get("group", ""), e.get("day", ""), e.get("time", ""), e.get("course", ""), e.get("room", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def scrape_program(driver, program_code: str, program_name: str, num_years: int):
    """Scrape one program completely and save files immediately."""
    _print(f"\n{'='*70}")
    _print(f"PROGRAM: {program_code} - {program_name}")
    _print(f"{'='*70}")
    
    program_folder = FACULTY_FOLDER / program_code
    program_folder.mkdir(exist_ok=True, parents=True)
    
    # Organize by year
    by_year: dict[str, list[dict]] = {}
    
    semester = "01"  # Semester 1 (constant for current extraction)
    
    for year_num in range(1, num_years + 1):
        year_str = f"{year_num:02d}"  # 01, 02, 03
        
        _print(f"\n  Year {year_num}:")
        
        year_entries = []
        # For each year, scrape all groups (1, 2, 3)
        for group_num in range(1, 4):  # Groups 1, 2, 3
            group_str = str(group_num)  # "1", "2", "3" (not zero-padded)
            group_label = f"#{program_code}|{semester}|{group_str}"
            fid_param = encode_group_id(program_code, semester, group_str)
            
            _print(f"    Group {group_num} ({group_label})...", end=" ", flush=True)
            
            entries = []
            for week in range(WEEKS_TO_SCRAPE):
                dt = START_DATE + timedelta(weeks=week)
                week_entries = scrape_week(driver, dt, resource_filter=fid_param)
                for e in week_entries:
                    e["group"] = group_label
                    e["program"] = program_code
                    e["program_name"] = program_name
                    e["year"] = year_str
                    e["semester"] = semester
                entries.extend(week_entries)
            
            entries = deduplicate_entries(entries)
            year_entries.extend(entries)
            _print(f"{len(entries)} entries")
        
        by_year[year_str] = deduplicate_entries(year_entries)
        _print(f"  Year {year_num} total: {len(by_year[year_str])} unique entries")
        
        # Save per year immediately (JSON only — .js duplicates are not used)
        year_json = program_folder / f"{program_code}_Year{year_str}.json"
        with open(year_json, "w", encoding="utf-8") as f:
            json.dump(by_year[year_str], f, indent=2, ensure_ascii=False)
        # #region agent log
        try:
            with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
                import json as j
                logf.write(j.dumps({"sessionId":"1f5f60","runId":"pre-fix","hypothesisId":"A","location":"scrape_timetable.py:497","message":"Saving year file","data":{"stdout_encoding":sys.stdout.encoding,"file":str(year_json)},"timestamp":int(time.time()*1000)}) + '\n')
        except: pass
        # #endregion
        _print(f"  [OK] Saved {year_json.name}")
    
    # Save program combined (all years)
    program_all = []
    for year_str in sorted(by_year.keys()):
        program_all.extend(by_year[year_str])
    program_all = deduplicate_entries(program_all)
    
    program_json = program_folder / f"{program_code}_AllYears.json"
    with open(program_json, "w", encoding="utf-8") as f:
        json.dump(program_all, f, indent=2, ensure_ascii=False)
    _print(f"\n  [OK] Saved {program_json.name} ({len(program_all)} entries)")
    
    return program_all


def main():
    # #region agent log
    try:
        with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
            import json as j
            logf.write(j.dumps({"sessionId":"1f5f60","runId":"main-start","hypothesisId":"A","location":"scrape_timetable.py:524","message":"Main function started","data":{"stdout_encoding":sys.stdout.encoding,"stderr_encoding":sys.stderr.encoding,"platform":sys.platform},"timestamp":int(time.time()*1000)}) + '\n')
    except: pass
    # #endregion
    _print(f"Starting CUT timetable scraper for {FACULTY_NAME}...")
    _print(f"Total programs: {len(PROGRAMS)}")
    FACULTY_FOLDER.mkdir(exist_ok=True, parents=True)
    
    driver = get_driver()
    all_entries = []
    
    try:
        for idx, (program_code, program_name, num_years) in enumerate(PROGRAMS, 1):
            _print(f"\n[{idx}/{len(PROGRAMS)}] Processing {program_code}...")
            try:
                program_entries = scrape_program(driver, program_code, program_name, num_years)
                all_entries.extend(program_entries)
                _print(f"[OK] Completed {program_code}")
            except Exception as e:
                # #region agent log
                try:
                    with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
                        import json as j
                        logf.write(j.dumps({"sessionId":"1f5f60","runId":"pre-fix","hypothesisId":"B","location":"scrape_timetable.py:546","message":"Error handler triggered","data":{"program":program_code,"error":str(e),"stdout_encoding":sys.stdout.encoding},"timestamp":int(time.time()*1000)}) + '\n')
                except: pass
                # #endregion
                _print(f"[ERROR] Processing {program_code}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Save faculty-wide combined file
        if all_entries:
            all_entries = deduplicate_entries(all_entries)
            faculty_json = FACULTY_FOLDER / "AllPrograms_AllYears.json"
            with open(faculty_json, "w", encoding="utf-8") as f:
                json.dump(all_entries, f, indent=2, ensure_ascii=False)
            _print(f"\n{'='*70}")
            _print(f"COMPLETE: Saved {faculty_json.name} ({len(all_entries)} total unique entries)")
            _print(f"{'='*70}")

    finally:
        driver.quit()

    return all_entries


if __name__ == "__main__":
    # #region agent log
    try:
        with open(DEBUG_LOG_PATH, 'w', encoding='utf-8') as logf:
            import json as j
            logf.write(j.dumps({"sessionId":"1f5f60","runId":"script-start","hypothesisId":"A","location":"scrape_timetable.py:570","message":"Script execution started","data":{"python_version":sys.version,"platform":sys.platform},"timestamp":int(time.time()*1000)}) + '\n')
    except Exception as e:
        # If we can't even write logs, something is very wrong
        try:
            with open(DEBUG_LOG_PATH, 'w', encoding='utf-8') as logf:
                logf.write(f"CRITICAL: Could not write initial log: {e}\n")
        except:
            pass
    # #endregion
    try:
        main()
    except Exception as e:
        # #region agent log
        try:
            with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as logf:
                import json as j
                import traceback
                logf.write(j.dumps({"sessionId":"1f5f60","runId":"script-crash","hypothesisId":"A","location":"scrape_timetable.py:575","message":"Script crashed with exception","data":{"error":str(e),"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + '\n')
        except: pass
        # #endregion
        # Use safe_print or regular print as fallback
        try:
            _print(f"[FATAL ERROR] Script crashed: {e}")
            import traceback
            traceback.print_exc()
        except:
            print(f"[FATAL ERROR] Script crashed: {e}")
            import traceback
            traceback.print_exc()
        raise
