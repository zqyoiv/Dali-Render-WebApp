# OSC Array Format for Unreal Engine

## Overview

When using the "Set Entire Garden" feature, the system sends **a single OSC message** containing an array of all objects to add/remove. This is optimized for Unreal Engine connectors that can process batch operations.

## OSC Message Structure

### Address
```
/garden/objects
```
Note: This is **plural "objects"** (not "object") to distinguish batch operations from single object operations.

### Arguments Format

The OSC message contains:
1. **Count** (integer) - Number of objects in the array
2. **Object Data** - For each object, 4 parameters in sequence:
   - Object ID (integer)
   - Location ID (string)
   - Location Type (string)
   - Action (integer: 1=add, 0=remove)

### Structure Diagram

```
/garden/objects
  ├─ [0] count (int)           - Number of objects (e.g., 5)
  ├─ [1] obj1_id (int)          - First object ID (e.g., 1)
  ├─ [2] obj1_location (string) - First object location (e.g., "M2")
  ├─ [3] obj1_type (string)     - First object location type (e.g., "M")
  ├─ [4] obj1_action (int)      - First object action (1=add, 0=remove)
  ├─ [5] obj2_id (int)          - Second object ID (e.g., 3)
  ├─ [6] obj2_location (string) - Second object location (e.g., "B4")
  ├─ [7] obj2_type (string)     - Second object location type (e.g., "B")
  ├─ [8] obj2_action (int)      - Second object action (1=add, 0=remove)
  └─ ... (continues for all objects)
```

### Total Arguments Count

```
Total Args = 1 + (count × 4)
```

For example:
- 5 objects = 1 + (5 × 4) = 21 arguments
- 22 objects = 1 + (22 × 4) = 89 arguments

## Example OSC Messages

### Example 1: Small Garden (5 objects)

```
/garden/objects 5 1 "M2" "M" 1 3 "B4" "B" 1 6 "B7" "B" 1 8 "RC1" "RC" 1 10 "B9" "B" 1
```

**Breakdown:**
- Count: 5
- Object 1: ID=1, Location=M2, Type=M, Action=ADD
- Object 3: ID=3, Location=B4, Type=B, Action=ADD
- Object 6: ID=6, Location=B7, Type=B, Action=ADD
- Object 8: ID=8, Location=RC1, Type=RC, Action=ADD
- Object 10: ID=10, Location=B9, Type=B, Action=ADD

### Example 2: With Removals

If clearing garden first, you'll get removals followed by additions:

```
/garden/objects 7 1 "M1" "M" 0 2 "RC2" "RC" 0 1 "M2" "M" 1 3 "B4" "B" 1 5 "RM1" "RM" 1 7 "M3" "M" 1 10 "B7" "B" 1
```

**Breakdown:**
- Count: 7
- Object 1: Remove from M1
- Object 2: Remove from RC2
- Object 1: Add at M2
- Object 3: Add at B4
- Object 5: Add at RM1
- Object 7: Add at M3
- Object 10: Add at B7

## JSON Representation

The system also returns a JSON representation of the array for logging:

```json
[
  {
    "objectId": "1",
    "location": "M2",
    "locationType": "M",
    "action": "ADD"
  },
  {
    "objectId": "3",
    "location": "B4",
    "locationType": "B",
    "action": "ADD"
  },
  {
    "objectId": "6",
    "location": "B7",
    "locationType": "B",
    "action": "ADD"
  }
]
```

This JSON is:
1. Logged to the server console
2. Returned in the API response
3. Displayed in the web UI

## Unreal Engine Implementation

### Blueprint Example (Pseudocode)

```blueprint
Event: On OSC Message Received
  ├─ Check Address == "/garden/objects"
  ├─ Parse Arg[0] as Count (Integer)
  ├─ For i = 0 to Count-1:
  │   ├─ Index = 1 + (i * 4)
  │   ├─ ObjectID = Parse Arg[Index] as Integer
  │   ├─ Location = Parse Arg[Index+1] as String
  │   ├─ LocationType = Parse Arg[Index+2] as String
  │   ├─ Action = Parse Arg[Index+3] as Integer
  │   └─ If Action == 1: Add Object(ObjectID, Location, LocationType)
  │       Else: Remove Object(ObjectID, Location, LocationType)
  └─ Complete
```

### C++ Example (Pseudocode)

```cpp
void OnOSCMessageReceived(FOSCMessage Message)
{
    if (Message.GetAddress() == "/garden/objects")
    {
        int32 Count = Message.GetInt32(0);
        
        for (int32 i = 0; i < Count; i++)
        {
            int32 Index = 1 + (i * 4);
            
            int32 ObjectID = Message.GetInt32(Index);
            FString Location = Message.GetString(Index + 1);
            FString LocationType = Message.GetString(Index + 2);
            int32 Action = Message.GetInt32(Index + 3);
            
            if (Action == 1)
            {
                AddObjectToGarden(ObjectID, Location, LocationType);
            }
            else
            {
                RemoveObjectFromGarden(ObjectID, Location, LocationType);
            }
        }
    }
}
```

## OSC Configuration

**Server (Node.js) Sends From:**
- Local Address: 127.0.0.1
- Local Port: 57121

**Unreal Engine Should Listen On:**
- Remote Address: 127.0.0.1
- Remote Port: 8001

## Comparison: Single vs Array

### Old Approach (Single Object Messages)

For 5 objects, sends 5 separate OSC messages:
```
/garden/object 1 "M2" "M" 1
/garden/object 3 "B4" "B" 1
/garden/object 6 "B7" "B" 1
/garden/object 8 "RC1" "RC" 1
/garden/object 10 "B9" "B" 1
```

**Issues:**
- Network overhead (5 separate UDP packets)
- Timing concerns (messages might arrive out of order)
- Cannot ensure atomicity

### New Approach (Array Message)

For 5 objects, sends 1 OSC message:
```
/garden/objects 5 1 "M2" "M" 1 3 "B4" "B" 1 6 "B7" "B" 1 8 "RC1" "RC" 1 10 "B9" "B" 1
```

**Benefits:**
- Single UDP packet
- Guaranteed order
- Atomic operation (all or nothing)
- Better performance
- Clearer intent (this is a batch operation)

## Testing

### View OSC Array in Console

When you run the batch operation, you'll see console output like:

```
🌱 Setting entire garden with 5 objects...
   Object IDs: [1, 3, 6, 8, 10]
   Clear first: true

📤 OSC ARRAY SENT to /garden/objects:
   Count: 5 objects
   Data: [
  {
    "objectId": "1",
    "location": "M2",
    "locationType": "M",
    "action": "ADD"
  },
  {
    "objectId": "3",
    "location": "B4",
    "locationType": "B",
    "action": "ADD"
  },
  ...
]
   Raw OSC Args Count: 21 (1 count + 20 object params)

✅ Garden setup complete: 5 objects added successfully, 0 failed
```

### View OSC Array in Web UI

After clicking "Set Entire Garden", the web UI displays:

**📤 OSC Array Sent:**
- Address: /garden/objects
- Count: 5 objects
- Array Data: [full JSON array displayed in scrollable box]

### Monitor with OSC Debug Tools

You can use tools like:
- **OSCulator** (macOS)
- **OSC Monitor** (cross-platform)
- **Protokol** (cross-platform)

Set them to listen on port 8001 to see the actual OSC messages.

## Location Types Reference

| Type | Name | Locations | Count |
|------|------|-----------|-------|
| M | Mountain | M1, M2, M3, M4, M5, M6 | 6 |
| B | Building | B1-B10 | 10 |
| RM | Rock Mountain | RM1, RM2 | 2 |
| RC | Rock Cave | RC1, RC2 | 2 |
| H | Hill | H1, H2 | 2 |

## API Response Format

When you call `POST /set-garden`, the response includes:

```json
{
  "success": true,
  "message": "Garden setup complete: 5 objects added successfully, 0 failed",
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  },
  "oscData": {
    "sent": true,
    "address": "/garden/objects",
    "count": 5,
    "array": [
      {
        "objectId": "1",
        "location": "M2",
        "locationType": "M",
        "action": "ADD"
      }
    ]
  },
  "addedObjects": [...],
  "removedObjects": [...],
  "gardenState": {...}
}
```

The `oscData` field contains exactly what was sent via OSC.

## Troubleshooting

### OSC Message Not Received

1. **Check Port**: Ensure Unreal Engine is listening on port 8001
2. **Check Address**: Look for `/garden/objects` (plural)
3. **Check Firewall**: Allow UDP traffic on port 8001
4. **Use OSC Monitor**: Verify messages are being sent

### Array Parsing Issues

1. **Verify Count**: First argument should match actual number of objects
2. **Verify Stride**: Each object is 4 arguments (ID, Location, Type, Action)
3. **Check Types**: ID and Action are integers, Location and Type are strings

### Performance Issues

If processing many objects (22+) is slow in Unreal Engine:
1. Consider processing array asynchronously
2. Batch render updates (don't update each object individually)
3. Use Unreal's async loading for object spawning

## Notes for Unreal Engine Developers

1. **The count parameter is provided** - You don't need to calculate array length
2. **Action values are consistent**: 1 = add, 0 = remove
3. **Location strings match the database** - Use them for positioning
4. **Location types indicate area** - Use for organizing objects by region
5. **Array is ordered** - Removals (if any) come before additions
6. **Atomic operation** - Process entire array before updating visuals

## Single Object Operations

For individual object operations (not batch), the system still uses the old format:

```
/garden/object <id> "<location>" "<type>" <action>
```

Example: `/garden/object 5 "M2" "M" 1`

This is sent when:
- Adding a single object via the UI
- Processing individual WebSocket commands
- Removing a single object

