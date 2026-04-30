# Image Path Update for Building, Floor, and Classroom

## Overview
Updated the image fetching system to dynamically generate image paths based on the new folder structure in `Images/Building/`.

## Image Format Structure
Images are now organized with the following naming convention:

- **Building Exterior**: `{building}.jpg`  
  Example: `14.jpg`, `12.jpg`, `13.jpg`, `20.jpg`

- **Floor Images**: `{building}_{floor}.jpg`  
  Example: `14_0.jpg`, `14_1.jpg`, `14_2.jpg`, `12_1.jpg`

- **Room/Door Images**: `{building}_{floor}_{room}.jpg`  
  Example: `14_0_027.jpg`, `14_1_159.jpg`, `12_0_001.jpg`

- **Inside Venue Images**: `{building}_{floor}_{room}_i.jpg`  
  Example: `14_0_027_i.jpg`, `14_1_159_i.jpg`

## Code Changes Made

### 1. **parseRoom() Function** (Line ~138)
- **Added**: `roomNumber` field to the returned object
- **Purpose**: Extract and return the room number from the timetable data (format: `building|floor|room`)
- **Before**: `{ venue, floor, buildingNumber }`
- **After**: `{ venue, floor, buildingNumber, roomNumber }`

### 2. **transformTimetable() Function** (Line ~179)
- **Added**: `roomNumber` field to slot objects
- **Purpose**: Preserve room number through the data pipeline
- **Data Flow**: rawEntry → parseRoom() → slot.roomNumber

### 3. **buildTimetableGrid() Function** (Line ~604)
- **Added**: `slot.dataset.roomNumber` storage
- **Purpose**: Store room number in DOM for later retrieval
- **Access**: `slotEl.dataset.roomNumber`

### 4. **openLecturerCard() Function** (Line ~742)
- **Added**: `roomNumber` extraction from `slotEl.dataset.roomNumber`
- **Purpose**: Make room number available to `getVenueImagesForSteps()`
- **Storage**: Added to `currentSlot` object

### 5. **getVenueImagesForSteps() Function** (Line ~806)
- **Complete Rewrite**: Generates dynamic image paths for 5-step directions
- **Logic**:
  - **Step 1** (Campus Map): Uses `CAMPUS_MAP_IMAGES` (unchanged)
  - **Step 2** (Building): `Images/Building/{building}.jpg`
  - **Step 3** (Floor): `Images/Building/{building}_{floor}.jpg`
  - **Step 4** (Room): `Images/Building/{building}_{floor}_{room}.jpg`
  - **Step 5** (Inside): `Images/Building/{building}_{floor}_{room}_i.jpg`
- **Fallback**: Uses stored custom instructions or placeholder images if dynamic images don't exist

## How It Works

1. User clicks on a timetable slot
2. `openLecturerCard()` is called with the slot element
3. Room data (building, floor, room number) is extracted from `slot.dataset`
4. When user clicks "Go to Class" button, `openDirections('class')` is called
5. `getVenueImagesForSteps()` generates the 5 image paths:
   - From timetable room field: `"13|1|103"` → building: `13`, floor: `1`, room: `103`
   - Generated paths:
     - Step 2: `Images/Building/13.jpg`
     - Step 3: `Images/Building/13_1.jpg`
     - Step 4: `Images/Building/13_1_103.jpg`
     - Step 5: `Images/Building/13_1_103_i.jpg`

## Example

For a timetable entry:
```json
{
  "room": "14|0|027, 14|1|157",
  ...
}
```

The system will extract: building=`14`, floor=`0`, room=`027`

And generate these image paths:
```
Images/Building/14.jpg          (Building exterior)
Images/Building/14_0.jpg        (Floor 0)
Images/Building/14_0_027.jpg    (Room door)
Images/Building/14_0_027_i.jpg  (Inside venue)
```

## Backward Compatibility

The code maintains full backward compatibility:
- If images don't exist, it falls back to stored custom images or placeholders
- Old `BUILDING_IMAGES` and `CAMPUS_MAP_IMAGES` mappings still work for Step 1 and 2
- The system gracefully handles missing images without breaking

## Notes

- Room numbers are extracted from the first room in comma-separated lists
- Multiple rooms are supported (e.g., `13|1|103, 13|1|105`), but only the first is used for image paths
- Floor is parsed as an integer for consistency
- Images should be saved with `.jpg` extension in `Images/Building/` folder
