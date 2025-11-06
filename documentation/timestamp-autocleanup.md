# Timestamp Tracking & Auto-Cleanup Feature

## Overview

The Dali Dream Garden now tracks creation timestamps for all objects and automatically removes the oldest half of objects after 5 minutes of inactivity.

## Features

### 1. Object Timestamp Tracking

Each object added to the garden is now tracked with a creation timestamp:

```javascript
GardenData.objectTimestamps = {
  "1": 1699234567890,  // timestamp when object was added
  "3": 1699234568123,
  // ... etc
}
```

**Automatic Tracking:**
- Timestamps are automatically recorded when objects are added (via single add, batch add, or WebSocket)
- Timestamps are automatically removed when objects are removed
- Timestamps are included in all garden state responses via `getGardenState()`

### 2. Auto-Cleanup (Inactivity Timer)

**Behavior:**
- A 5-minute inactivity timer starts/resets whenever objects are added or removed
- If no activity occurs for 5 minutes, the system automatically removes the **oldest half** of objects
- The timer is automatically cancelled if the garden becomes empty
- The timer does NOT restart after auto-cleanup (waits for next manual activity)

**Example:**
```
Garden has 10 objects → No activity for 5 minutes → Auto-removes 5 oldest objects
Garden has 7 objects → No activity for 5 minutes → Auto-removes 3 oldest objects
Garden has 3 objects → No activity for 5 minutes → Auto-removes 1 oldest object
Garden has 1 object → No activity for 5 minutes → No removal (needs at least 2)
```

**Console Output:**
```
⏰ 5 minutes of inactivity detected - triggering auto-cleanup
🗑️ Auto-cleanup: Removing oldest 5 of 10 objects
✅ Auto-cleanup complete: Removed 5 objects. Garden now has 5 objects
```

## API Changes

### Updated Endpoints

#### GET `/garden-state`
Now includes `objectTimestamps` in the response:

```json
{
  "success": true,
  "gardenState": {
    "objects": ["1", "3", "16"],
    "locations": ["M1", "B2", "RM1"],
    "addingOrder": ["1", "3", "16"],
    "objectTimestamps": {
      "1": 1699234567890,
      "3": 1699234568123,
      "16": 1699234569456
    },
    "stateVersion": 5,
    "lastModified": 1699234569456
  }
}
```

### New Endpoints

#### POST `/cleanup-oldest`
Manually trigger removal of the oldest half of objects:

```bash
curl -X POST http://localhost:4000/cleanup-oldest
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 5 oldest objects",
  "removedCount": 5,
  "removedObjects": [
    {
      "id": "1",
      "name": "HandButterfly",
      "location": "M1",
      "timestamp": 1699234567890,
      "reason": "auto_cleanup_inactivity"
    },
    // ... more removed objects
  ],
  "gardenState": {
    // ... updated garden state
  }
}
```

## Implementation Details

### Timer Management

**When Timer Starts/Resets:**
- Any object addition (single, batch, or WebSocket)
- Any object removal
- Calling `updateStateMetadata()` after any state change

**When Timer is Cancelled:**
- Garden becomes empty (no objects to clean up)
- Server shutdown

**Timer Duration:**
- 5 minutes (300,000 milliseconds)
- Configurable via `INACTIVITY_TIMEOUT` constant in `object-manager.js`

### Removal Reason Codes

Objects can be removed for various reasons, tracked in `removedObject.reason`:

- `duplicate` - Same object added twice
- `oldest` - Removed due to garden capacity (22 objects max)
- `forced_displacement` - No available locations, displaced existing object
- `cleared` - Manual garden clear
- `auto_cleanup_inactivity` - **NEW** - Removed by auto-cleanup timer

## Module Exports

New function exported from `object-manager.js`:

```javascript
const { removeOldestHalf } = require('./object-manage/object-manager');
```

## Configuration

To change the inactivity timeout duration, edit `object-manager.js`:

```javascript
// Change from 5 minutes to desired duration
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // milliseconds
```

## Testing

### Test Auto-Cleanup

1. Add objects to the garden
2. Wait 5 minutes without any activity
3. Check console logs for auto-cleanup messages
4. Verify half of the objects were removed

### Test Manual Cleanup

```bash
# Add some objects
curl -X POST http://localhost:4000/add/1
curl -X POST http://localhost:4000/add/3
curl -X POST http://localhost:4000/add/16

# Check current state
curl http://localhost:4000/garden-state

# Manually trigger cleanup
curl -X POST http://localhost:4000/cleanup-oldest

# Check state again
curl http://localhost:4000/garden-state
```

## Notes

- Auto-cleanup only removes objects, never adds them
- Timestamps are stored in milliseconds (Unix epoch time)
- The timer is server-side only (not synchronized across multiple instances)
- Timestamps survive garden operations but are cleared on garden clear
- The inactivity timer respects the `addingOrder` array to determine "oldest"

