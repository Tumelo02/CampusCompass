# Timetable Builder

A small tool for typing timetable slots into a form and exporting a data file in the
exact format used by the files under `timetable/courses/`.

## Running it

Double-click **`builder-9f3a2c.html`**. It opens in any browser (Chrome, Edge, Firefox).

That's it — there is nothing to install. No Node, no Python, no internet connection,
no web server. The entire tool is one self-contained HTML file (~25 KB) with the CSS
and JavaScript inlined.

## Using it on the deployed site

After deploying, the builder is reachable at:

```
https://<your-domain>/timetable/builder-9f3a2c.html
```

The `9f3a2c` suffix keeps the URL from being guessed, and the page carries a
`noindex, nofollow` tag so search engines skip it. Treat the URL as semi-private
and don't link to it from the main site.

This is obscurity, not authentication — anyone with the link can open it. That is
acceptable here because the builder is entirely client-side: it reads nothing
from the server and writes nothing back, so a stranger opening it can only type
into their own browser and download a file to their own machine. Live timetable
data is unaffected.

The builder is deliberately not in the service worker's cached assets, so the
deployed copy needs a live connection. Running the file locally avoids that.

## Sharing it with someone else

Copy `builder-9f3a2c.html` to the other Windows PC by any means — USB stick, email
attachment, OneDrive, Teams, WhatsApp. It is a single file with no dependencies, so
it works anywhere it lands. The recipient just double-clicks it.

The file does not need to sit inside this project folder to work.

## How to use it

1. **Program details** — fill in the program code, program name, year, and semester
   **once**. These four values are written into every slot automatically, so you
   never retype them. Click **Lock** to protect them from accidental edits.
   - Typing a known program code (e.g. `B_CON`) auto-fills the program name.
   - The group field auto-fills as `#PROGRAM|YEAR|1`; edit it if yours differs.
   - Week start and group act as defaults and can be overridden per slot.

2. **Add slot** — pick the day, then enter time, course, room, and lecturer.
   Press `Enter` in any field to add the slot and jump straight to the next one.
   - Room may be left blank; it exports as `""`, matching the existing files.
   - The time field suggests the standard campus periods as you type.

3. **Slots table** — review what you have entered. **Edit** loads a row back into
   the form; **Del** removes it. Rows sharing the same day + time + course are
   highlighted amber as likely duplicates.

4. **Sort by day & time** — orders entries Monday→Friday and by start time, the
   same order the existing files use.

5. **Download file** — saves as `<PROGRAM>_Year<YEAR>.json`, for example
   `B_CON_Year01.json`. Put it in `timetable/courses/<PROGRAM>/`.

Your work is saved in the browser automatically, so closing the tab does not lose
it. **Import existing** loads a file back in to continue editing it later.

## Output format

Standard JSON — a flat array of slot objects, 2-space indented, with keys in this
order:

```json
[
  {
    "day": "Monday",
    "time": "1:55 PM - 3:20 PM",
    "course": "PIM5011|01|1",
    "room": "",
    "lecturer": "#B_CON|01|1, PIM5011|01|1|C|E2",
    "week_start": "2026-04-20",
    "group": "#B_CON|01|1",
    "program": "B_CON",
    "program_name": "Bachelor of Construction",
    "year": "01",
    "semester": "01"
  }
]
```

Exports use CRLF line endings with no trailing newline, matching the existing
course files byte for byte. Untick the CRLF box in the Output panel if you want
plain LF instead.

## After exporting

A new timetable file is not picked up by the app on its own. You also need to:

1. Save the file to `timetable/courses/<PROGRAM>/<PROGRAM>_Year<YEAR>.json`.
2. Register it in `timetable/index.json` under that program's `years` array:
   ```json
   { "year": "01", "timetable": "courses/B_CON/B_CON_Year01.json" }
   ```
3. Rebuild the bundle the app loads: `python build_bundle.py`
