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

### 2. Auto-Initialize After Inactivity

**Behavior:**
- A 5-minute inactivity timer **always runs**, even when the garden is empty
- If no activity occurs for 5 minutes, the system automatically **reinitializes the garden**
- Reinitialization clears all objects and adds the **6 default objects** (same as startup)
- The timer does NOT restart after auto-initialization (waits for next manual activity)
- **Protection rule:** Gardens with 1-6 objects are protected from auto-initialization
- **Empty gardens (0 objects) and gardens with 7+ objects will auto-initialize**

**Default Objects Added:**
- Object 18: LobsterSaxophone
- Object 1: HandButterfly
- Object 3: BreadHead
- Object 16: EggEye
- Object 15: ThumbClock
- Object 4: HeadDrawer

**Example:**
```
Garden has 10 objects → No activity for 5 minutes → Clears all, adds 6 default objects ✅
Garden has 7 objects → No activity for 5 minutes → Clears all, adds 6 default objects ✅
Garden has 6 objects → No activity for 5 minutes → No change (1-6 protected) 🛡️
Garden has 3 objects → No activity for 5 minutes → No change (1-6 protected) 🛡️
Garden has 0 objects (empty) → No activity for 5 minutes → Adds 6 default objects ✅
```

**Console Output:**
```
⏰ 5 minutes of inactivity detected - triggering garden initialization
🔄 Auto-initialization triggered: Resetting garden to default state
🧹 Cleared X objects from garden
📦 Batch operation complete: 6 added, 0 failed
✅ Auto-initialization complete: Garden reset to 6 default objects
```

**If empty garden:**
```
⏰ 5 minutes of inactivity detected - triggering garden initialization
🔄 Auto-initialization triggered: Garden is empty, adding default objects
🌱 Initializing garden on startup...
   Adding 6 default objects...
✅ Auto-initialization complete: Garden reset to 6 default objects
```

**If 1-6 objects (protected):**
```
⏰ 5 minutes of inactivity detected - triggering garden initialization
🛡️ Auto-initialization skipped: Only 3 objects in garden (1-6 objects are protected)
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

#### POST `/init-garden`
Manually trigger garden initialization (same as startup):

```bash
curl -X POST http://localhost:4000/init-garden
```

**Response:**
```json
{
  "success": true,
  "message": "Garden initialized with 6 objects",
  "gardenState": {
    // ... updated garden state with 6 default objects
  },
  "oscSent": true
}
```

#### POST `/cleanup-oldest`
Manually trigger removal of the oldest half of objects (does NOT reinitialize):

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
      "reason": "manual_cleanup"
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
- `cleared` - Manual garden clear via `/clear-garden` endpoint
- `manual_cleanup` - Manual cleanup via `/cleanup-oldest` endpoint

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

### Test Auto-Initialize

1. Add 7+ objects to the garden
2. Wait 5 minutes without any activity
3. Check console logs for auto-initialization messages
4. Verify garden was reset to 6 default objects

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

- Auto-initialization clears ALL objects and adds 6 defaults (resets to startup state)
- The timer **always runs**, even when the garden is empty (0 objects)
- Gardens with 1-6 objects are **protected** from auto-initialization
- Empty gardens (0 objects) will auto-initialize after 5 minutes
- Gardens with 7+ objects will auto-initialize after 5 minutes
- Manual cleanup endpoint (`/cleanup-oldest`) removes half without reinitializing
- Timestamps are stored in milliseconds (Unix epoch time)
- The timer is server-side only (not synchronized across multiple instances)
- Timestamps survive garden operations but are cleared on garden clear

