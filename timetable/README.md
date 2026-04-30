# CUT Timetable Scraper

Extracts **all courses and lectures** from the Central University of Technology (CUT) Bloemfontein timetable (CELCAT Calendar) and saves them as JSON and a JavaScript file for use in apps or frontends.

## What it does

- **Target:** [timetable.cut.ac.za/BLOEM_CALENDAR](https://timetable.cut.ac.za/BLOEM_CALENDAR) (list week view with a resource filter so events load).
- **Extracts:** Course names, lecturers, days, times, rooms, and any extra columns (e.g. faculty/department if present).
- **Output:**
  - `timetable_data.json` – full data for scripts or APIs.
  - `timetable_data.js` – same data as `var timetableData = [...];` for frontend use.

## Setup

1. **Python 3.10+** (recommended).

2. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Chrome** installed (Selenium uses Chrome by default).

## Run

```bash
python scrape_timetable.py
```

- Runs in **headless** Chrome by default.
- Scrapes **4 weeks** starting from the date in the script (default `2026-02-19`).
- To watch the browser, set `headless=False` in `get_driver()` in `scrape_timetable.py`.

## Configuration (in `scrape_timetable.py`)

| Variable           | Purpose |
|--------------------|--------|
| `ENTITY_TYPE`      | `"group"` = group timetable; or `"module"`, `"lecturer"`, etc. |
| `RESOURCE_FILTERS` | List of `(group_label, fid_param)` e.g. `("#B_ETE|01|1", "fid0=%23B_ETE%7C01%7C1")`. Each group is scraped and entries tagged with `group`. |
| `VIEW_TYPE`        | `"listWeek"` = week list; also `"agendaWeek"`, `"agendaDay"` |
| `WEEKS_TO_SCRAPE`  | Number of weeks to fetch from `START_DATE` |
| `START_DATE`       | First day of the first week to scrape |

## If the page structure changes

The script tries:

1. A **table** (IDs: `calendarTable`, `tblTimetable`, `timetable`, etc., or the first table).
2. **List/event divs** (e.g. `.event`, `.fc-event`, `[class*='event']`).

Column order assumed for tables: **day, time, course, room, lecturer** (+ any extra columns). If CELCAT changes layout or IDs, open the timetable URL in Chrome, use **Inspect** (F12) to find the real table or event elements, then adjust in `scrape_timetable.py`:

- Table ID/selector in `extract_from_table()`.
- Event/list selectors in `extract_from_list_container()`.
- Column indices in the entry dict (e.g. which index is course, room, lecturer).

## Requirements

- `requests`, `beautifulsoup4` – for possible future non-JS fallback or parsing.
- `selenium` – to drive the browser and read the live DOM.
- `webdriver-manager` – downloads and uses the correct ChromeDriver automatically (no manual path).

## License

Use in line with CUT’s website terms and for personal/educational use only.
