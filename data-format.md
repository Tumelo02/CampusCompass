# Timetable data format (for scrape / upload)

Use this format when you scrape the university timetable and save as JSON, then upload it in the **Admin dashboard → Upload data**.

## Top-level structure

```json
{
  "courses": [ ... ],
  "lecturers": { ... }
}
```

- **courses** – array of course objects (one per course code).
- **lecturers** – object mapping lecturer id to lecturer details (shared across courses).

---

## Course object

| Field   | Type   | Required | Description |
|--------|--------|----------|-------------|
| code   | string | Yes      | Course code (e.g. `IENDCY336`). |
| name   | string | No       | Display name (e.g. `Industrial Engineering · Year 3`). |
| timetable | array | No    | Array of slot objects (see below). |

Example:

```json
{
  "code": "IENDCY336",
  "name": "Industrial Engineering · Year 3",
  "timetable": [
    {
      "day": "mon",
      "start": 8,
      "span": 1,
      "subject": "Mathematics",
      "venue": "Room 101 · Mr. Chen",
      "floor": 1,
      "type": "theory",
      "lecturerId": "chen"
    },
    {
      "day": "mon",
      "start": 10,
      "span": 1,
      "break": true
    }
  ]
}
```

---

## Slot object

| Field     | Type   | Required | Description |
|----------|--------|----------|-------------|
| day      | string | Yes      | Day: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`. |
| start    | number | Yes      | Start hour (e.g. 8 = 08:00). |
| span     | number | No       | Length in hours (default 1). |
| break    | boolean| No       | If true, slot is break/lunch (no subject/venue). |
| subject  | string | No*      | Subject name (*required if not break). |
| venue    | string | No*      | Room/lab and teacher (e.g. `Room 101 · Mr. Chen`). |
| floor    | number | No       | Floor (0 = ground). Default 1. |
| type     | string | No       | `theory` or `practical`. Default `theory`. |
| lecturerId | string| No       | Key into `lecturers` (e.g. `chen`). |

---

## Lecturers object

Keys are lecturer ids (e.g. `chen`, `okonkwo`). Values are objects with:

| Field         | Type   | Description |
|---------------|--------|-------------|
| name          | string | Full name (e.g. Mr. Chen, Dr. Okonkwo). |
| title         | string | Role/subject (e.g. Mathematics). |
| office        | string | Office location (e.g. Room 101, Block A). |
| officeFloor   | number | Floor for office (0 = ground). |
| classBuilding | string | Building for class directions (e.g. Block A). |
| consultation   | string | Consultation hours text. |
| email         | string | Email address. |
| photo         | string | Optional: URL or base64 image. |

Example:

```json
{
  "lecturers": {
    "chen": {
      "name": "John Chen",
      "title": "Mathematics",
      "office": "Room 101, Block A",
      "officeFloor": 1,
      "classBuilding": "Block A",
      "consultation": "Mon & Wed 14:00 – 16:00",
      "email": "j.chen@school.edu"
    }
  }
}
```

---

## Single-course upload

You can also upload a single course without wrapping in `courses`:

```json
{
  "courseCode": "IENDCY336",
  "courseName": "Industrial Engineering · Year 3",
  "timetable": [ ... ],
  "lecturers": { ... }
}
```

The importer will normalize this into the main structure.

---

## Where data is stored

- **Admin dashboard** saves to **localStorage** in the browser (keys: `timetable_admin_data`, `timetable_venue_images`).
- To use this data in the **student app** (index.html), you will need to either:
  - Load from the same localStorage when the app runs, or
  - Add a small backend that reads this data and the student app fetches it via API.

Venue images uploaded in **Admin → Venue images** are stored as base64 in `timetable_venue_images` and can later be used by the “How to get there” flow when you connect the student app to this storage or an API.
