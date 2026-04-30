"""
Check why certain groups have 0 entries by testing URLs directly.
This helps determine if groups don't exist or if there's a scraping issue.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import time

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

FACULTY_FOLDER = Path(__file__).parent / "Engineering_Built_Environment_Information_Technology"
BASE_URL = "https://timetable.cut.ac.za/BLOEM_CALENDAR/cal"
START_DATE = datetime(2026, 2, 20)


def encode_group_id(program: str, year: str, group: str) -> str:
    """Encode #PROGRAM|YEAR|GROUP to URL format."""
    encoded = f"%23{program}%7C{year}%7C{group}"
    return f"fid0={encoded}"


def build_url(dt: datetime, resource_filter: str) -> str:
    date_str = dt.strftime("%Y-%m-%d")
    return f"{BASE_URL}?vt=listWeek&dt={date_str}&et=group&{resource_filter}"


def check_group_exists(program_code: str, year_str: str, group_num: int, driver) -> dict:
    """Check if a group exists and has data by loading the URL."""
    group_label = f"#{program_code}|{year_str}|{group_num}"
    fid_param = encode_group_id(program_code, year_str, str(group_num))
    url = build_url(START_DATE, fid_param)
    
    result = {
        "group": group_label,
        "url": url,
        "page_loads": False,
        "has_calendar": False,
        "has_events": False,
        "event_count": 0,
        "error": None,
    }
    
    try:
        driver.get(url)
        time.sleep(3)  # Wait for page load
        
        result["page_loads"] = True
        
        # Check if calendar table exists
        try:
            tables = driver.find_elements(By.TAG_NAME, "table")
            result["has_calendar"] = len(tables) > 0
        except:
            pass
        
        # Check for events
        try:
            events = driver.find_elements(By.CSS_SELECTOR, ".fc-event, [class*='event'], td a[href]")
            visible_events = [e for e in events if e.is_displayed() and e.text.strip()]
            result["has_events"] = len(visible_events) > 0
            result["event_count"] = len(visible_events)
        except Exception as e:
            result["error"] = str(e)
        
        # Check page title/content for error messages
        try:
            page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            if "no events" in page_text or "no data" in page_text:
                result["no_data_message"] = True
        except:
            pass
            
    except Exception as e:
        result["error"] = str(e)
        result["page_loads"] = False
    
    return result


def main():
    print("=" * 80)
    print("CHECKING ZERO-ENTRY GROUPS")
    print("=" * 80)
    
    # Find programs with 0 entries
    zero_programs = []
    zero_year2_groups = []
    
    for program_folder in FACULTY_FOLDER.iterdir():
        if not program_folder.is_dir():
            continue
        
        program_code = program_folder.name
        year01_file = program_folder / f"{program_code}_Year01.json"
        
        if not year01_file.exists():
            continue
        
        try:
            with open(year01_file, "r", encoding="utf-8") as f:
                year01_data = json.load(f)
            
            # Check if program has 0 entries
            if len(year01_data) == 0:
                zero_programs.append((program_code, "01", "all"))
            
            # Check Year 2 groups
            year02_file = program_folder / f"{program_code}_Year02.json"
            if year02_file.exists():
                with open(year02_file, "r", encoding="utf-8") as f:
                    year02_data = json.load(f)
                if len(year02_data) == 0:
                    for group_num in range(1, 4):
                        zero_year2_groups.append((program_code, "02", group_num))
        except:
            pass
    
    print(f"\nFound {len(zero_programs)} programs with 0 Year 1 entries")
    print(f"Found {len(zero_year2_groups)} Year 2 groups with 0 entries")
    
    # Test a sample of zero-entry groups
    print("\n" + "=" * 80)
    print("TESTING SAMPLE GROUPS")
    print("=" * 80)
    
    driver = None
    try:
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        # Test 3 programs with 0 entries
        print("\n[TESTING PROGRAMS WITH ZERO ENTRIES]")
        print("-" * 80)
        for program_code, year_str, group_info in zero_programs[:3]:
            if group_info == "all":
                # Test Group 1
                result = check_group_exists(program_code, year_str, 1, driver)
                print(f"\n{program_code} Year {year_str} Group 1:")
                print(f"  URL: {result['url']}")
                print(f"  Page loads: {result['page_loads']}")
                print(f"  Has calendar: {result['has_calendar']}")
                print(f"  Has events: {result['has_events']}")
                print(f"  Event count: {result['event_count']}")
                if result.get("error"):
                    print(f"  Error: {result['error']}")
        
        # Test Year 2 groups from programs that have Year 1 data
        print("\n[TESTING YEAR 2 GROUPS (from programs with Year 1 data)]")
        print("-" * 80)
        tested = 0
        for program_code, year_str, group_num in zero_year2_groups[:5]:
            # Check if this program has Year 1 data
            year01_file = FACULTY_FOLDER / program_code / f"{program_code}_Year01.json"
            if year01_file.exists():
                with open(year01_file, "r", encoding="utf-8") as f:
                    if len(json.load(f)) > 0:
                        result = check_group_exists(program_code, year_str, group_num, driver)
                        print(f"\n{program_code} Year {year_str} Group {group_num}:")
                        print(f"  URL: {result['url']}")
                        print(f"  Page loads: {result['page_loads']}")
                        print(f"  Has calendar: {result['has_calendar']}")
                        print(f"  Has events: {result['has_events']}")
                        print(f"  Event count: {result['event_count']}")
                        if result.get("error"):
                            print(f"  Error: {result['error']}")
                        tested += 1
                        if tested >= 3:
                            break
        
    finally:
        if driver:
            driver.quit()
    
    print("\n" + "=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)
    print("\nInterpretation:")
    print("- If 'Page loads: True' and 'Has calendar: True' but 'Has events: False':")
    print("  → Group exists but has no timetable data (EXPECTED)")
    print("- If 'Page loads: False' or 'Has calendar: False':")
    print("  → Group might not exist or URL format is wrong")
    print("- If 'Has events: True' but scraper found 0:")
    print("  → Scraping issue (needs investigation)")


if __name__ == "__main__":
    main()
