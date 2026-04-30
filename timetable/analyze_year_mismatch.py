"""Analyze if entries in AllYears have mismatched year fields or are missing from year files."""

import json
from pathlib import Path
from collections import defaultdict

FACULTY_FOLDER = Path(__file__).parent / "Engineering_Built_Environment_Information_Technology"

def analyze_program(program_code: str):
    """Analyze one program for year field mismatches."""
    program_folder = FACULTY_FOLDER / program_code
    if not program_folder.exists():
        return None
    
    # Load all year files
    years_data = {}
    year_files = {}
    for year_file in sorted(program_folder.glob(f"{program_code}_Year*.json")):
        year_name = year_file.stem.replace(f"{program_code}_Year", "")
        try:
            with open(year_file, "r", encoding="utf-8") as f:
                years_data[year_name] = json.load(f)
                year_files[year_name] = year_file.name
        except:
            years_data[year_name] = []
    
    # Load AllYears file
    all_years_file = program_folder / f"{program_code}_AllYears.json"
    if not all_years_file.exists():
        return None
    
    try:
        with open(all_years_file, "r", encoding="utf-8") as f:
            all_years_data = json.load(f)
    except:
        return None
    
    print(f"\n{'='*80}")
    print(f"ANALYZING: {program_code}")
    print(f"{'='*80}")
    
    # Group AllYears entries by their 'year' field
    all_years_by_field = defaultdict(list)
    for entry in all_years_data:
        year_field = entry.get("year", "unknown")
        all_years_by_field[year_field].append(entry)
    
    print(f"\nAllYears.json contains {len(all_years_data)} entries")
    print("Breakdown by 'year' field in entries:")
    for year_field in sorted(all_years_by_field.keys()):
        print(f"  Year field '{year_field}': {len(all_years_by_field[year_field])} entries")
    
    print(f"\nIndividual year files:")
    for year_name in sorted(years_data.keys()):
        print(f"  {year_files[year_name]}: {len(years_data[year_name])} entries")
    
    # Check for entries with year field that doesn't match file name
    print(f"\nChecking for mismatches:")
    issues = []
    
    for year_field, entries in all_years_by_field.items():
        # Find which file should contain these entries
        expected_file = f"{program_code}_Year{year_field}.json"
        
        # Check if this year file exists
        if year_field not in years_data:
            issues.append(f"Year field '{year_field}' entries exist in AllYears but no Year{year_field}.json file!")
            print(f"  [ISSUE] Year field '{year_field}': {len(entries)} entries in AllYears, but no Year{year_field}.json file")
            continue
        
        # Check if entries match
        file_entries = years_data[year_field]
        if len(entries) != len(file_entries):
            issues.append(f"Year field '{year_field}': {len(entries)} in AllYears vs {len(file_entries)} in Year{year_field}.json")
            print(f"  [ISSUE] Year field '{year_field}': {len(entries)} entries in AllYears, {len(file_entries)} in Year{year_field}.json")
        
        # Check for entries in AllYears that aren't in the year file
        file_keys = set(
            (e.get("group", ""), e.get("time", ""), e.get("course", ""), e.get("room", ""), e.get("week_start", ""))
            for e in file_entries
        )
        all_keys = set(
            (e.get("group", ""), e.get("time", ""), e.get("course", ""), e.get("room", ""), e.get("week_start", ""))
            for e in entries
        )
        
        missing_in_file = all_keys - file_keys
        if missing_in_file:
            issues.append(f"Year field '{year_field}': {len(missing_in_file)} entries in AllYears missing from Year{year_field}.json")
            print(f"  [ISSUE] Year field '{year_field}': {len(missing_in_file)} entries in AllYears NOT found in Year{year_field}.json")
            print(f"    Sample: {list(missing_in_file)[:2]}")
    
    if not issues:
        print("  [OK] No mismatches found!")
    
    return issues


def main():
    programs = [
        "B_ETE", "DP_ELE", "B_MEC", "DP_MEC", "B_CVLE", "DP_CVL",
        "B_CQS", "B_CON", "ITEC", "DP_IT", "B_INF", "HC_CON", "IEHCRE"
    ]
    
    all_issues = []
    for program_code in programs:
        issues = analyze_program(program_code)
        if issues:
            all_issues.extend(issues)
    
    print(f"\n{'='*80}")
    if all_issues:
        print(f"TOTAL ISSUES FOUND: {len(all_issues)}")
        for issue in all_issues:
            print(f"  - {issue}")
    else:
        print("NO ISSUES FOUND - All entries match correctly!")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
