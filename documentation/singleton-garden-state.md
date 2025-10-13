# Singleton Garden State - Design Documentation

## Overview

The Dali Render WebApp uses a **singleton pattern** for the garden state, ensuring there is only ONE authoritative garden state across the entire application, regardless of how objects are added or modified.

## Why Singleton?

### The Problem
Without a singleton pattern:
- Different parts of the app might have different views of the garden
- Adding an object from WebSocket might not sync with UI additions
- Batch operations might conflict with individual additions
- Unreal Engine might receive inconsistent state

### The Solution
With a singleton pattern:
- ✅ **One source of truth** - All operations modify the same state
- ✅ **Consistency** - Changes from any source update the same data
- ✅ **Cumulative updates** - Each change builds on the previous state
- ✅ **Unreal Engine sync** - OSC messages reflect the true state

## Implementation

### Singleton State Object

Located in `object-manage/object-manager.js`:

```javascript
/**
 * SINGLETON GARDEN STATE
 * This is the single source of truth for the garden state across the entire application.
 * All operations (batch, single, WebSocket) modify this same state.
 */
let GardenData = {
    objects: [],          // Object IDs currently in garden
    locations: [],        // Corresponding location IDs
    addingOrder: [],      // Order objects were added (oldest first)
    stateVersion: 0,      // Increments with each change
    lastModified: 0       // Timestamp of last change
};
```

### State Tracking

Every state modification increments the version:

```javascript
function updateStateMetadata() {
    GardenData.stateVersion++;
    GardenData.lastModified = Date.now();
    console.log(`🔄 Garden State Updated - Version: ${GardenData.stateVersion}, Objects: ${GardenData.objects.length}/22`);
}
```

## How Different Operations Use the Same State

### 1. Single Object Addition (UI)
```
User clicks "Add Object 5" in UI
  ↓
POST /add/5
  ↓
processAddObject(5, 'HTTP POST')
  ↓
addObject(5)
  ↓
Modifies GardenData (singleton)
  ↓
updateStateMetadata() → Version 1
  ↓
Sends OSC message
  ↓
Returns updated state
```

### 2. WebSocket Command (Another App)
```
Another app sends: /add/10/session/abc123
  ↓
WebSocket relay receives message
  ↓
handleAddObject(10, 'abc123')
  ↓
processAddObject(10, 'WebSocket Relay')
  ↓
addObject(10)
  ↓
Modifies SAME GardenData (singleton)
  ↓
updateStateMetadata() → Version 2
  ↓
Sends OSC message
  ↓
Returns updated state
```

### 3. Batch Operation (Set Entire Garden)
```
User clicks "Set Entire Garden" with [1, 3, 5, 7, 10]
  ↓
POST /set-garden
  ↓
If clearFirst=true:
  ├─ Clears GardenData completely
  └─ Sends OSC removals
  ↓
addObjectsBatch([1, 3, 5, 7, 10])
  ↓
For each object:
  ├─ Modifies SAME GardenData (singleton)
  └─ Builds OSC array
  ↓
updateStateMetadata() → Version 3
  ↓
Sends SINGLE OSC message with array
  ↓
Returns updated state
```

## Example Scenario: Mixed Updates

### Scenario
1. User adds object 5 via UI
2. Another app adds object 10 via WebSocket
3. User sets entire garden with [1, 2, 3] (clearFirst=false)
4. Another app adds object 20 via WebSocket

### What Happens

```
Initial State: 
  objects: []
  stateVersion: 0

Step 1: UI adds object 5
  objects: [5]
  locations: [M2]
  stateVersion: 1 ← version increments
  OSC: /garden/object 5 "M2" "M" 1

Step 2: WebSocket adds object 10
  objects: [5, 10] ← cumulative, builds on step 1
  locations: [M2, B3]
  stateVersion: 2 ← version increments again
  OSC: /garden/object 10 "B3" "B" 1

Step 3: Set garden [1, 2, 3] WITHOUT clear
  objects: [5, 10, 1, 2, 3] ← adds to existing state
  locations: [M2, B3, M1, RC1, B4]
  stateVersion: 3 ← version increments
  OSC: /garden/objects 3 1 "M1" "M" 1 2 "RC1" "RC" 1 3 "B4" "B" 1

Step 4: WebSocket adds object 20
  objects: [5, 10, 1, 2, 3, 20] ← cumulative
  locations: [M2, B3, M1, RC1, B4, RC2]
  stateVersion: 4 ← version increments
  OSC: /garden/object 20 "RC2" "RC" 1

Final State:
  objects: [5, 10, 1, 2, 3, 20]
  locations: [M2, B3, M1, RC1, B4, RC2]
  addingOrder: [5, 10, 1, 2, 3, 20] (chronological)
  stateVersion: 4
```

## Clearing vs. Adding

### Adding to Existing State (clearFirst=false)
```javascript
Current: [5, 10]
Add: [1, 2, 3]
Result: [5, 10, 1, 2, 3] ← cumulative
```

### Replacing Entire State (clearFirst=true)
```javascript
Current: [5, 10]
Set with clearFirst: [1, 2, 3]
  ↓
  1. Clear: [] ← removes all
  2. Add: [1, 2, 3] ← starts fresh
Result: [1, 2, 3] ← completely replaced
```

## Unreal Engine Synchronization

### Every State Change Sends OSC

**Single Object Changes:**
```
/garden/object <id> "<location>" "<type>" <action>
```

**Batch Changes (clearFirst=true):**
```
/garden/objects <count> 
  <removed objects...>  ← all removals first (action=0)
  <added objects...>    ← all additions (action=1)
```

**Batch Changes (clearFirst=false):**
```
/garden/objects <count>
  <added objects...>    ← only additions (action=1)
```

### Unreal Engine Should
1. Listen on port 8001
2. Process all messages in order
3. Trust that state is always consistent
4. Use state version for debugging/verification

## State Version Tracking

### In Console Logs
```
🌐 HTTP POST - Adding object 5 to SINGLETON garden state
   ✅ State updated - Version: 1, Total objects: 1/22

🌐 WebSocket command received - Adding object 10 to SINGLETON garden state
   ✅ State updated - Version: 2, Total objects: 2/22

🌱 Setting entire garden with 3 objects...
   🔄 ADDING to existing garden state - cumulative with previous changes
   ✅ Garden setup complete: 3 objects added successfully, 0 failed
   📊 Final State - Version: 3, Total objects: 5/22
```

### In Web UI
The Garden Monitor shows:
```
🔒 Singleton Garden State
Version: 3 | Last Modified: 10/13/2025, 2:30:45 PM
```

### In API Responses
```json
{
  "gardenState": {
    "objects": [5, 10, 1, 2, 3],
    "locations": ["M2", "B3", "M1", "RC1", "B4"],
    "addingOrder": [5, 10, 1, 2, 3],
    "stateVersion": 3,
    "lastModified": 1697198445000
  }
}
```

## Guarantees

### ✅ Consistency
- All operations work on the same `GardenData` object
- No matter how you add objects, they all modify the same state

### ✅ Cumulative Updates
- Unless `clearFirst=true`, all additions are cumulative
- WebSocket + UI + Batch all build on each other

### ✅ Order Preservation
- `addingOrder` array tracks chronological order
- Oldest objects removed first when garden is full

### ✅ OSC Synchronization
- Every state change sends OSC messages
- Unreal Engine receives all updates in order

### ✅ State Tracking
- Version number increments with each change
- Timestamp tracks last modification
- Easy to debug state evolution

## Best Practices

### For UI Operations
- Single additions are cumulative
- Use "Clear Garden" to reset before batch operations
- Monitor state version to track changes

### For WebSocket Integration
- WebSocket commands are cumulative with UI operations
- State persists across all command sources
- No conflict between WebSocket and UI additions

### For Batch Operations
- Use `clearFirst=true` to completely replace the garden
- Use `clearFirst=false` to add to existing objects
- Check state version to verify operation completed

### For Unreal Engine
- Listen for both `/garden/object` (single) and `/garden/objects` (batch)
- Process all OSC messages in order
- Trust that state is always consistent
- Use state version for verification/logging

## Debugging State

### Check Current State
```bash
# Via API
curl http://localhost:4000/garden-state

# Returns:
{
  "success": true,
  "gardenState": {
    "objects": [...],
    "stateVersion": 5,
    "lastModified": 1697198445000
  }
}
```

### Monitor State Changes
Watch the console logs for:
```
🔄 Garden State Updated - Version: X, Objects: Y/22
```

### Web UI Monitoring
- Garden Monitor shows current state version
- Auto-refreshes every 30 seconds
- Shows timestamp of last modification

## Technical Implementation Details

### Module-Level Singleton
```javascript
// object-manager.js exports functions, not the state
module.exports = {
    addObject,
    removeObject,
    getGardenState,
    clearGarden,
    addObjectsBatch
};

// GardenData is module-private (not exported)
// All exported functions close over the same GardenData
```

### Why This Works
- Node.js caches required modules
- Only one instance of `object-manager.js` exists
- All `require('./object-manage/object-manager')` get the same instance
- GardenData persists for the lifetime of the process

### State is Never Exported
```javascript
// ✅ Correct - functions access singleton
const { addObject } = require('./object-manage/object-manager');
addObject(5); // Modifies singleton state

// ❌ Wrong - would break singleton if we did this
const { GardenData } = require('./object-manage/object-manager');
// GardenData is NOT exported - this is intentional
```

## Summary

The Dali Render WebApp ensures complete state consistency through:

1. **Singleton Pattern** - One GardenData object, accessed by all operations
2. **State Versioning** - Track every change with incrementing version
3. **Cumulative Updates** - All additions build on previous state (unless cleared)
4. **OSC Synchronization** - Every change syncs with Unreal Engine
5. **Clear Logging** - Easy to track state evolution
6. **Flexible Operations** - UI, WebSocket, and Batch all work together

**Result**: Your Unreal Engine always receives consistent, ordered state updates, regardless of how objects are added to the garden. 🌱

