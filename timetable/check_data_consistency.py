"""Check for data consistency between individual year files and AllYears files."""

import json
from pathlib import Path

FACULTY_FOLDER = Path(__file__).parent / "Engineering_Built_Environment_Information_Technology"

def check_program(program_code: str):
    """Check one program for consistency issues."""
    program_folder = FACULTY_FOLDER / program_code
    if not program_folder.exists():
        return None
    
    # Load all year files
    years_data = {}
    for year_file in sorted(program_folder.glob(f"{program_code}_Year*.json")):
        year_name = year_file.stem.replace(f"{program_code}_Year", "")
        try:
            with open(year_file, "r", encoding="utf-8") as f:
                years_data[year_name] = json.load(f)
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
    
    # Check consistency
    issues = []
    
    # Sum of individual years
    sum_individual = sum(len(entries) for entries in years_data.values())
    total_all_years = len(all_years_data)
    
    if sum_individual != total_all_years:
        issues.append(f"Count mismatch: Individual years sum={sum_individual}, AllYears={total_all_years}")
    
    # Check for entries in AllYears that aren't in individual years
    all_individual_entries = []
    for year_entries in years_data.values():
        all_individual_entries.extend(year_entries)
    
    # Create sets for comparison (using key fields)
    individual_keys = set()
    for entry in all_individual_entries:
        key = (
            entry.get("group", ""),
            entry.get("time", ""),
            entry.get("course", ""),
            entry.get("room", ""),
            entry.get("week_start", ""),
        )
        individual_keys.add(key)
    
    all_years_keys = set()
    for entry in all_years_data:
        key = (
            entry.get("group", ""),
            entry.get("time", ""),
            entry.get("course", ""),
            entry.get("room", ""),
            entry.get("week_start", ""),
        )
        all_years_keys.add(key)
    
    missing_in_individual = all_years_keys - individual_keys
    missing_in_all_years = individual_keys - all_years_keys
    
    if missing_in_individual:
        issues.append(f"Entries in AllYears but NOT in individual year files: {len(missing_in_individual)}")
        # Show sample
        sample = list(missing_in_individual)[:3]
        issues.append(f"  Sample missing entries: {sample}")
    
    if missing_in_all_years:
        issues.append(f"Entries in individual files but NOT in AllYears: {len(missing_in_all_years)}")
    
    return {
        "program": program_code,
        "individual_sum": sum_individual,
        "all_years_count": total_all_years,
        "match": sum_individual == total_all_years,
        "issues": issues,
        "years": {k: len(v) for k, v in years_data.items()},
    }


def main():
    print("=" * 80)
    print("DATA CONSISTENCY CHECK")
    print("=" * 80)
    
    programs = [
        "B_ETE", "DP_ELE", "B_MEC", "DP_MEC", "B_CVLE", "DP_CVL",
        "B_CQS", "B_CON", "ITEC", "DP_IT", "B_INF", "HC_CON", "IEHCRE"
    ]
    
    issues_found = False
    for program_code in programs:
        result = check_program(program_code)
        if result and result["issues"]:
            issues_found = True
            print(f"\n[ISSUE] {program_code}:")
            print(f"  Individual years sum: {result['individual_sum']}")
            print(f"  AllYears count: {result['all_years_count']}")
            print(f"  Years breakdown: {result['years']}")
            for issue in result["issues"]:
                print(f"  - {issue}")
        elif result and not result["match"]:
            issues_found = True
            print(f"\n[WARNING] {program_code}: Count mismatch")
            print(f"  Individual: {result['individual_sum']}, AllYears: {result['all_years_count']}")
    
    if not issues_found:
        print("\n[OK] All programs have consistent data between individual year files and AllYears files!")
    else:
        print("\n[ACTION NEEDED] Found inconsistencies - need to investigate")
    
    print("=" * 80)


if __name__ == "__main__":
    main()
