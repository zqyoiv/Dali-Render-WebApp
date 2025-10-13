# Singleton Garden State - Quick Reference

## What is it?

**ONE garden state** shared across ALL operations:
- ✅ Adding objects via UI
- ✅ Adding objects via WebSocket (from other apps)
- ✅ Batch operations (Set Entire Garden)
- ✅ All synced with Unreal Engine

## Key Concept

```
┌─────────────────────────────────────────┐
│   SINGLETON GARDEN STATE (GardenData)   │
│   - objects: [5, 10, 1, 2, 3]          │
│   - locations: [M2, B3, M1, RC1, B4]   │
│   - stateVersion: 3                     │
│   - lastModified: timestamp             │
└─────────────────────────────────────────┘
         ↑         ↑         ↑
         │         │         │
    ┌────┴────┐ ┌─┴──────┐ ┌┴─────────┐
    │   UI    │ │WebSocket│ │  Batch   │
    │  POST   │ │ Relay   │ │Operation │
    └─────────┘ └─────────┘ └──────────┘
         │         │         │
         └─────────┴─────────┘
                   │
          ┌────────┴────────┐
          │  Unreal Engine  │
          │  (OSC Port 8001)│
          └─────────────────┘
```

## How Changes Work

### Cumulative (Default)
```
Start: []
Add 5 (UI):         [5]
Add 10 (WebSocket): [5, 10]
Batch [1,2,3]:      [5, 10, 1, 2, 3]
Add 20 (WebSocket): [5, 10, 1, 2, 3, 20]
```
**Each operation builds on the previous state.**

### Replace (clearFirst=true)
```
Start: [5, 10]
Set Garden [1,2,3] with clearFirst=true:
  → Clear: []
  → Add: [1, 2, 3]
Result: [1, 2, 3]
```
**Completely replaces the garden state.**

## State Version Tracking

Every change increments the version:

```
Version 0: [] (initial)
Version 1: [5] (added 5)
Version 2: [5, 10] (added 10)
Version 3: [5, 10, 1, 2, 3] (batch add)
Version 4: [5, 10, 1, 2, 3, 20] (added 20)
```

## Where You See It

### Console Logs
```
🔄 Garden State Updated - Version: 3, Objects: 5/22
```

### Web UI
```
🔒 Singleton Garden State
Version: 3 | Last Modified: 10/13/2025, 2:30:45 PM
```

### API Response
```json
{
  "gardenState": {
    "objects": [5, 10, 1, 2, 3],
    "stateVersion": 3,
    "lastModified": 1697198445000
  }
}
```

## Example Workflow

### Scenario: Building a Garden Across Multiple Sources

```
1. Designer adds object 5 from main app
   → State: [5], Version: 1

2. Artist adds object 10 from their app (WebSocket)
   → State: [5, 10], Version: 2
   
3. You test with Set Garden [1,2,3] (NO clear)
   → State: [5, 10, 1, 2, 3], Version: 3
   
4. Designer adds object 20 from main app again
   → State: [5, 10, 1, 2, 3, 20], Version: 4

All operations work together! ✅
```

### Scenario: Resetting the Garden

```
Current: [5, 10, 1, 2, 3, 20]

You want to START FRESH with [7, 8, 9]:
  → Use clearFirst=true
  → Sends OSC removals for [5, 10, 1, 2, 3, 20]
  → Clears state to []
  → Adds [7, 8, 9]
  
Result: [7, 8, 9], Version: 5

Clean slate! ✅
```

## OSC Synchronization

### Single Object
```
UI adds object 5:
  OSC → /garden/object 5 "M2" "M" 1

WebSocket adds object 10:
  OSC → /garden/object 10 "B3" "B" 1
```

### Batch (Array)
```
Set Garden [1, 2, 3]:
  OSC → /garden/objects 3 1 "M1" "M" 1 2 "RC1" "RC" 1 3 "B4" "B" 1
```

### Batch with Clear
```
Set Garden [1, 2, 3] with clearFirst=true:
  OSC → /garden/objects 5
    5 "M2" "M" 0      ← Remove old objects
    10 "B3" "B" 0
    1 "M1" "M" 1      ← Add new objects
    2 "RC1" "RC" 1
    3 "B4" "B" 1
```

## Guarantees

| Guarantee | Description |
|-----------|-------------|
| **One State** | All operations modify the same GardenData |
| **Cumulative** | Changes build on each other (unless cleared) |
| **Ordered** | addingOrder tracks chronological sequence |
| **Versioned** | stateVersion increments with each change |
| **Synced** | Every change sends OSC to Unreal Engine |
| **Consistent** | Unreal Engine always has the latest state |

## Best Practices

### ✅ DO
- Add objects from multiple sources (they all work together)
- Use clearFirst=true when you want to completely reset
- Monitor state version to track changes
- Trust that state is always consistent

### ❌ DON'T
- Worry about conflicts between UI and WebSocket
- Try to manually track state (the system does it)
- Assume old state is lost (it's cumulative unless cleared)

## Quick Commands

### Check Current State
```bash
curl http://localhost:4000/garden-state
```

### Add Single Object
```bash
curl -X POST http://localhost:4000/add/5
```

### Set Entire Garden (Add to Existing)
```bash
curl -X POST http://localhost:4000/set-garden \
  -H "Content-Type: application/json" \
  -d '{"clearFirst": false, "objectIds": [1,2,3]}'
```

### Set Entire Garden (Replace All)
```bash
curl -X POST http://localhost:4000/set-garden \
  -H "Content-Type: application/json" \
  -d '{"clearFirst": true, "objectIds": [1,2,3]}'
```

### Clear Garden
```bash
curl -X POST http://localhost:4000/clear-garden
```

## For Your Unreal Engine Connector

You don't need to worry about state management! Just:

1. **Listen** on port 8001 for OSC messages
2. **Process** both `/garden/object` (single) and `/garden/objects` (batch)
3. **Trust** that messages represent the true state
4. **Apply** changes as they arrive

The server guarantees:
- All messages are in order
- State is always consistent
- No conflicts or race conditions

## More Info

See **[documentation/singleton-garden-state.md](documentation/singleton-garden-state.md)** for complete technical details.

## Summary

**You have ONE garden state that:**
- Works across all apps and commands
- Tracks every change with version numbers
- Syncs automatically with Unreal Engine
- Builds cumulatively (unless you clear first)

**Just add objects however you want - the system keeps everything consistent!** 🌱✨

