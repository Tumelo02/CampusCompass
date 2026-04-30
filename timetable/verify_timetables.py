"""
Verification script for CUT timetable scraping.
Analyzes extracted data to identify:
1. Programs/years/groups with 0 entries
2. Data quality issues
3. Potential scraping problems vs. expected empty results
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
import re

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

FACULTY_FOLDER = Path(__file__).parent / "Engineering_Built_Environment_Information_Technology"

# Expected programs and their years
PROGRAMS = {
    "B_ETE": 3,
    "DP_ELE": 3,
    "B_MEC": 3,
    "DP_MEC": 3,
    "B_CVLE": 3,
    "DP_CVL": 3,
    "B_CQS": 3,
    "B_CON": 3,
    "ITEC": 3,
    "DP_IT": 3,
    "B_INF": 3,
    "HC_CON": 1,
    "IEHCRE": 1,
}


def analyze_program(program_code: str, num_years: int):
    """Analyze one program's data."""
    program_folder = FACULTY_FOLDER / program_code
    if not program_folder.exists():
        return {"status": "missing_folder", "years": {}}
    
    results = {
        "program": program_code,
        "num_years": num_years,
        "years": {},
        "total_entries": 0,
        "has_data": False,
    }
    
    # Check each year
    for year_num in range(1, num_years + 1):
        year_str = f"{year_num:02d}"
        year_file = program_folder / f"{program_code}_Year{year_str}.json"
        
        year_data = {
            "year": year_str,
            "file_exists": year_file.exists(),
            "entries": 0,
            "groups": {},
            "has_data": False,
        }
        
        if year_file.exists():
            try:
                with open(year_file, "r", encoding="utf-8") as f:
                    entries = json.load(f)
                    year_data["entries"] = len(entries)
                    year_data["has_data"] = len(entries) > 0
                    results["total_entries"] += len(entries)
                    results["has_data"] = results["has_data"] or len(entries) > 0
                    
                    # Analyze by group
                    groups = defaultdict(list)
                    for entry in entries:
                        group = entry.get("group", "unknown")
                        groups[group].append(entry)
                    
                    for group_label, group_entries in sorted(groups.items()):
                        year_data["groups"][group_label] = {
                            "count": len(group_entries),
                            "sample_entry": group_entries[0] if group_entries else None,
                        }
                    
                    # Check for expected groups
                    for group_num in range(1, 4):
                        expected_group = f"#{program_code}|{year_str}|{group_num}"
                        if expected_group not in year_data["groups"]:
                            year_data["groups"][expected_group] = {
                                "count": 0,
                                "sample_entry": None,
                                "missing": True,
                            }
            except Exception as e:
                year_data["error"] = str(e)
        
        results["years"][year_str] = year_data
    
    # Check AllYears file
    all_years_file = program_folder / f"{program_code}_AllYears.json"
    if all_years_file.exists():
        try:
            with open(all_years_file, "r", encoding="utf-8") as f:
                all_entries = json.load(f)
                results["all_years_entries"] = len(all_entries)
                results["all_years_matches_total"] = (
                    results["all_years_entries"] == results["total_entries"]
                )
        except Exception as e:
            results["all_years_error"] = str(e)
    
    return results


def verify_data_quality(entries: list[dict]) -> dict:
    """Verify data quality of entries."""
    required_fields = ["course", "time", "room", "group", "program", "year"]
    quality = {
        "total": len(entries),
        "missing_fields": defaultdict(int),
        "empty_fields": defaultdict(int),
        "valid_entries": 0,
    }
    
    for entry in entries:
        is_valid = True
        for field in required_fields:
            value = entry.get(field, "")
            if field not in entry:
                quality["missing_fields"][field] += 1
                is_valid = False
            elif not value or (isinstance(value, str) and value.strip() == ""):
                quality["empty_fields"][field] += 1
        
        if is_valid:
            quality["valid_entries"] += 1
    
    return quality


def generate_report():
    """Generate comprehensive verification report."""
    print("=" * 80)
    print("CUT TIMETABLE VERIFICATION REPORT")
    print("=" * 80)
    
    all_results = {}
    zero_entry_programs = []
    zero_entry_years = []
    zero_entry_groups = []
    
    for program_code, num_years in sorted(PROGRAMS.items()):
        results = analyze_program(program_code, num_years)
        all_results[program_code] = results
        
        if not results["has_data"]:
            zero_entry_programs.append(program_code)
        
        for year_str, year_data in results["years"].items():
            if year_data.get("entries", 0) == 0:
                zero_entry_years.append(f"{program_code} Year {year_str}")
            
            for group_label, group_data in year_data.get("groups", {}).items():
                if group_data.get("count", 0) == 0:
                    zero_entry_groups.append(f"{program_code} {group_label}")
    
    # Summary
    print("\n[SUMMARY]")
    print("-" * 80)
    total_programs = len(PROGRAMS)
    programs_with_data = total_programs - len(zero_entry_programs)
    print(f"Total programs: {total_programs}")
    print(f"Programs with data: {programs_with_data}")
    print(f"Programs with 0 entries: {len(zero_entry_programs)}")
    
    total_entries = sum(r["total_entries"] for r in all_results.values())
    print(f"\nTotal timetable entries extracted: {total_entries}")
    
    # Programs with 0 entries
    if zero_entry_programs:
        print("\n[WARNING] PROGRAMS WITH ZERO ENTRIES (all years):")
        print("-" * 80)
        for prog in zero_entry_programs:
            print(f"  - {prog}")
            results = all_results[prog]
            print(f"    Expected years: {results['num_years']}")
            for year_str, year_data in results["years"].items():
                file_status = "[OK] exists" if year_data.get("file_exists") else "[MISSING]"
                print(f"    Year {year_str}: {year_data.get('entries', 0)} entries ({file_status})")
    
    # Year 2+ analysis
    print("\n[YEAR 2 AND YEAR 3 ANALYSIS]")
    print("-" * 80)
    year2_zero = [y for y in zero_entry_years if "Year 02" in y or "Year 03" in y]
    year1_with_data = [
        prog
        for prog, results in all_results.items()
        if results["years"].get("01", {}).get("entries", 0) > 0
    ]
    
    print(f"Programs with Year 1 data: {len(year1_with_data)}")
    print(f"Year 2/3 entries that are zero: {len(year2_zero)}")
    
    if year1_with_data:
        print("\n  Programs that have Year 1 data but Year 2/3 are empty:")
        for prog in year1_with_data:
            results = all_results[prog]
            year1_entries = results["years"].get("01", {}).get("entries", 0)
            year2_entries = results["years"].get("02", {}).get("entries", 0)
            year3_entries = results["years"].get("03", {}).get("entries", 0)
            if year1_entries > 0 and (year2_entries == 0 or year3_entries == 0):
                print(f"    {prog}: Year1={year1_entries}, Year2={year2_entries}, Year3={year3_entries}")
                print(f"      → Likely: Year 2/3 groups don't exist in CELCAT or have no timetable data")
    
    # Groups with 0 entries (within Year 1)
    print("\n[GROUPS WITH ZERO ENTRIES (Year 1 only)]")
    print("-" * 80)
    year1_zero_groups = [
        g for g in zero_entry_groups if "|01|" in g and g.split()[0] in year1_with_data
    ]
    if year1_zero_groups:
        for group_label in sorted(set(year1_zero_groups))[:10]:  # Show first 10
            print(f"  - {group_label}")
        if len(year1_zero_groups) > 10:
            print(f"  ... and {len(year1_zero_groups) - 10} more")
        print(f"\n  Total Year 1 groups with 0 entries: {len(year1_zero_groups)}")
        print("  → Likely: These groups don't exist or have no timetable data")
    else:
        print("  None (all Year 1 groups have data)")
    
    # Data quality check
    print("\n[DATA QUALITY CHECK]")
    print("-" * 80)
    all_entries_sample = []
    for program_code, results in all_results.items():
        for year_str, year_data in results["years"].items():
            if year_data.get("entries", 0) > 0:
                year_file = FACULTY_FOLDER / program_code / f"{program_code}_Year{year_str}.json"
                try:
                    with open(year_file, "r", encoding="utf-8") as f:
                        entries = json.load(f)
                        all_entries_sample.extend(entries[:5])  # Sample
                except:
                    pass
    
    if all_entries_sample:
        quality = verify_data_quality(all_entries_sample)
        print(f"Sample entries checked: {len(all_entries_sample)}")
        print(f"Valid entries: {quality['valid_entries']}/{quality['total']}")
        if quality["missing_fields"]:
            print(f"Missing fields: {dict(quality['missing_fields'])}")
        if quality["empty_fields"]:
            print(f"Empty fields: {dict(quality['empty_fields'])}")
    
    # Detailed program breakdown
    print("\n[DETAILED PROGRAM BREAKDOWN]")
    print("-" * 80)
    for program_code in sorted(all_results.keys()):
        results = all_results[program_code]
        status_icon = "[OK]" if results["has_data"] else "[EMPTY]"
        print(f"\n{status_icon} {program_code} ({results['total_entries']} total entries):")
        for year_str in sorted(results["years"].keys()):
            year_data = results["years"][year_str]
            entries = year_data.get("entries", 0)
            groups_info = []
            for group_label in sorted(year_data.get("groups", {}).keys()):
                count = year_data["groups"][group_label].get("count", 0)
                if count > 0:
                    groups_info.append(f"{group_label.split('|')[-1]}:{count}")
                else:
                    groups_info.append(f"{group_label.split('|')[-1]}:0")
            groups_str = ", ".join(groups_info)
            print(f"    Year {year_str}: {entries} entries [{groups_str}]")
    
    # Recommendations
    print("\n[RECOMMENDATIONS]")
    print("-" * 80)
    print("1. Year 2/3 with 0 entries:")
    print("   → These groups likely don't exist in CELCAT or have no timetable data")
    print("   → This is EXPECTED if:")
    print("     - Academic year hasn't started for those years")
    print("     - Groups haven't been created in the system")
    print("     - No timetable has been assigned yet")
    print()
    print("2. Programs with 0 entries (ITEC, DP_IT, B_INF):")
    print("   → Verify these program codes exist in CELCAT")
    print("   → Check if they use different group naming conventions")
    print("   → May need different resource filter format")
    print()
    print("3. Groups within Year 1 with 0 entries:")
    print("   → Some groups (e.g., Group 3) may not exist for all programs")
    print("   → This is normal - not all programs have 3 groups")
    
    # Save report to file
    report_file = FACULTY_FOLDER / "verification_report.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("CUT TIMETABLE VERIFICATION REPORT\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Total programs: {total_programs}\n")
        f.write(f"Programs with data: {programs_with_data}\n")
        f.write(f"Total entries: {total_entries}\n\n")
        f.write("Programs with 0 entries:\n")
        for prog in zero_entry_programs:
            f.write(f"  - {prog}\n")
        f.write("\nYear 2/3 with 0 entries:\n")
        for y in year2_zero[:20]:
            f.write(f"  - {y}\n")
    
    print(f"\n[REPORT] Full report saved to: {report_file}")
    print("=" * 80)


if __name__ == "__main__":
    if not FACULTY_FOLDER.exists():
        print(f"Error: Faculty folder not found: {FACULTY_FOLDER}")
        exit(1)
    
    generate_report()
