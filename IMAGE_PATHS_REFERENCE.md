# Quick Reference: Image Path Generation

## Room Data Parsing

**Input from timetable JSON:**
```json
"room": "14|0|027, 14|1|157"
```

**Extracted by parseRoom():**
- `buildingNumber`: "14"
- `floor`: 0
- `roomNumber`: "027"

## Image Paths Generated

For Building 14, Floor 0, Room 027:

| Step | Purpose | Image Path | File Location |
|------|---------|-----------|-----------------|
| 1 | Campus Map | `Images/CUT_MAP/CUT_BHP.png` | From CAMPUS_MAP_IMAGES |
| 2 | Building Exterior | `Images/Building/14.jpg` | Building folder |
| 3 | Floor Plan | `Images/Building/14_0.jpg` | Building folder |
| 4 | Room/Door | `Images/Building/14_0_027.jpg` | Building folder |
| 5 | Inside Venue | `Images/Building/14_0_027_i.jpg` | Building folder |

## Data Flow Diagram

```
JSON Timetable Entry
  ↓
parseRoom("14|0|027, ...")
  ↓
{ buildingNumber: "14", floor: 0, roomNumber: "027" }
  ↓
slot object in transformTimetable()
  ↓
slot.dataset in buildTimetableGrid()
  ↓
currentSlot object in openLecturerCard()
  ↓
getVenueImagesForSteps() → Image paths
  ↓
Display in 5-step directions
```

## File Naming Examples

**Building Exteriors:**
- 12.jpg, 13.jpg, 14.jpg, 20.jpg

**Floors:**
- 12_0.jpg, 12_1.jpg, 12_2.jpg
- 14_0.jpg, 14_1.jpg
- 20_0.jpg, 20_1.jpg

**Rooms:**
- 12_0_001.jpg, 12_0_002.jpg
- 14_0_027.jpg, 14_0_028.jpg
- 14_1_159.jpg, 14_1_161.jpg

**Inside Venue:**
- 14_0_027_i.jpg
- 14_1_159_i.jpg

## How to Add Images

1. Place images in `Images/Building/` folder
2. Name them according to the structure: `{building}_{floor}_{room}[_i].jpg`
3. The app will automatically use them when users view directions
4. If an image is missing, the system falls back to stored custom images or placeholders

## Testing

To test the image paths:
1. Open timetable app
2. Select a course with class location (e.g., B_ETE_Year02)
3. Click on any class slot
4. In the lecturer card, click "Go to Class"
5. Step images should show the corresponding building, floor, and room images

## Supported Image Extensions

- `.jpg` (primary)
- `.png` (for campus maps - handled separately)

The system generates `.jpg` paths for building/floor/room images.
