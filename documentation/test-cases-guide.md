# Test Cases Guide - Set Entire Garden

## Overview

This guide describes the batch object addition functionality that allows you to set up an entire garden with multiple objects via OSC messages in a single operation.

## Features

### 1. Batch Object Addition
- Add multiple objects to the garden in one operation
- Each object addition sends OSC messages to the rendering system
- Automatic location assignment based on object requirements
- Support for up to 22 objects (maximum garden capacity)

### 2. Test Cases

Five predefined test cases are available:

#### Small Garden (5 objects)
- **Object IDs**: [1, 3, 6, 8, 10]
- **Objects**:
  - 1: HandButterfly (M, RM)
  - 3: BreadHead (M, B, RM)
  - 6: TreeHole (B)
  - 8: LobsterKey (M, RC)
  - 10: Giraffe+Tire (B)
- **Use Case**: Testing basic functionality with diverse location types

#### Medium Garden (12 objects)
- **Object IDs**: [1, 2, 3, 5, 7, 10, 13, 15, 18, 20, 22, 25]
- **Use Case**: Testing medium-sized gardens with varied placement types

#### Large Garden (18 objects)
- **Object IDs**: [1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 30]
- **Use Case**: Testing near-capacity gardens

#### Full Garden (22 objects)
- **Object IDs**: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
- **Use Case**: Testing maximum capacity (22 objects)

#### Diverse Mix (15 objects)
- **Object IDs**: [1, 3, 6, 7, 10, 11, 14, 17, 19, 21, 23, 24, 26, 28, 30]
- **Objects Cover All Location Types**:
  - M (Mountain): 6 locations
  - B (Building): 10 locations
  - RM (Rock Mountain): 2 locations
  - RC (Rock Cave): 2 locations
  - H (Hill): 2 locations
- **Use Case**: Testing diverse object placement across all location types

## API Endpoints

### POST /set-garden
Set up the entire garden with multiple objects.

**Request Body**:
```json
{
  "clearFirst": true,
  "objectIds": [1, 2, 3, 5, 7, 10]
}
```

**Parameters**:
- `clearFirst` (boolean): If true, clears all existing objects before adding new ones
- `objectIds` (array): Array of object IDs (1-30) to add to the garden

**Response**:
```json
{
  "success": true,
  "message": "Garden setup complete: 6 objects added successfully, 0 failed",
  "summary": {
    "total": 6,
    "successful": 6,
    "failed": 0
  },
  "addedObjects": [
    {
      "id": "1",
      "name": "HandButterfly",
      "location": "M2"
    }
  ],
  "removedObjects": [],
  "results": [...],
  "gardenState": {
    "objects": ["1", "2", "3", "5", "7", "10"],
    "locations": ["M2", "RC1", "M3", "B4", "M1", "B7"],
    "addingOrder": ["1", "2", "3", "5", "7", "10"]
  }
}
```

### POST /clear-garden
Clear all objects from the garden.

**Response**:
```json
{
  "success": true,
  "message": "Garden cleared successfully",
  "gardenState": {
    "objects": [],
    "locations": [],
    "addingOrder": []
  }
}
```

### POST /add/:number
Add a single object to the garden (existing endpoint).

**Example**: `POST /add/5`

## OSC Messages

All object additions and removals send OSC messages to the rendering system.

**OSC Message Format**:
```
Address: /garden/object
Arguments:
  - Object ID (integer)
  - Location ID (string, e.g., "M1", "B3")
  - Location Type (string, e.g., "M", "B", "RM")
  - Action (integer, 1=add, 0=remove)
```

**Example Messages**:
- Adding object 1 at M2: `/garden/object 1 "M2" "M" 1`
- Removing object 1 from M2: `/garden/object 1 "M2" "M" 0`

## Object Requirements

Each object has specific location type requirements:

| Object ID | Name | Allowed Locations |
|-----------|------|-------------------|
| 1 | HandButterfly | M, RM |
| 2 | FlowerInsect1 | M, RC |
| 3 | BreadHead | M, B, RM |
| 4 | HeadDrawer | M, B, RM |
| 5 | ShelReal | M, B, RM |
| 6 | TreeHole | B |
| 7 | BreadKey | M, B |
| 8 | LobsterKey | M, RC |
| 9 | EggHand | M, RM |
| 10 | Giraffe+Tire | B |
| 11 | Skeleton | M, RM |
| 12 | HighheelCrutch | M, RM |
| 13 | FlowerWoman | M, B, RM |
| 14 | FlowerInsect2 | M, RC |
| 15 | ThumbClock | M, RM |
| 16 | EggEye | M, RM |
| 17 | BellTower | B |
| 18 | LobsterSaxophone | M, RM |
| 19 | SpoonChair | M, B |
| 20 | CupAnt | M, RC |
| 21 | EggString | H |
| 22 | EyelashFlower | M, RM |
| 23 | WheelbarrowClock | M, B |
| 24 | ElephantLongLeg | B |
| 25 | UpSofa | M, B |
| 26 | SpoonMoon | M, RC |
| 27 | LobsterChair | M, B |
| 28 | HandTree | M, B |
| 29 | CabinetKeyhole | M, B |
| 30 | PianoWater | M, B |

## Location Types

Available locations in the garden:

- **M (Mountain)**: M1, M2, M3, M4, M5, M6 (6 spots)
- **B (Building)**: B1, B2, B3, B4, B5, B6, B7, B8, B9, B10 (10 spots)
- **RM (Rock Mountain)**: RM1, RM2 (2 spots)
- **RC (Rock Cave)**: RC1, RC2 (2 spots)
- **H (Hill)**: H1, H2 (2 spots)

**Total**: 22 locations (matches maximum capacity)

## Usage Examples

### Web Interface

1. **Select a Test Case**: Choose from the dropdown (Small, Medium, Large, Full, or Diverse)
2. **Clear First Option**: Check if you want to clear the garden before adding objects
3. **Click "Set Entire Garden"**: Initiates batch object addition
4. **View Results**: See detailed results with added/removed objects and final garden state
5. **Monitor Garden**: The garden monitor automatically updates after the operation

### API Usage

```javascript
// Set up a full garden
fetch('http://localhost:4000/set-garden', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clearFirst: true,
    objectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  })
})
.then(response => response.json())
.then(data => console.log(data));

// Clear the garden
fetch('http://localhost:4000/clear-garden', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## Behavior Notes

1. **Location Assignment**: Objects are randomly assigned to available compatible locations
2. **Duplicate Handling**: If an object already exists, it's removed before being re-added
3. **Capacity Management**: When the garden reaches 22 objects, the oldest object is removed
4. **OSC Messages**: Every addition and removal sends an OSC message to port 8001
5. **Order Tracking**: Objects are tracked in the order they were added (oldest to newest)

## Testing Workflow

1. **Start with Small Garden**: Test basic functionality
2. **Try Medium Garden**: Verify handling of multiple objects
3. **Test Clear Garden**: Ensure proper cleanup with OSC messages
4. **Try Full Garden**: Test maximum capacity (22 objects)
5. **Test Without Clear**: Add objects without clearing to test displacement
6. **Monitor OSC**: Verify OSC messages are sent correctly (port 8001)

## Troubleshooting

- **Objects Not Appearing**: Check if object IDs are valid (1-30)
- **OSC Not Working**: Verify OSC receiver is listening on port 8001
- **Garden State Not Updating**: Check browser console for errors
- **Location Conflicts**: System automatically handles location conflicts

