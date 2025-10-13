# OSC Array Quick Start

## What Changed?

Previously, when setting the entire garden, the system sent **individual OSC messages** for each object:
```
/garden/object 1 "M2" "M" 1
/garden/object 3 "B4" "B" 1
/garden/object 6 "B7" "B" 1
... (one message per object)
```

Now, the system sends **a single OSC message with an array** of all objects:
```
/garden/objects 5 1 "M2" "M" 1 3 "B4" "B" 1 6 "B7" "B" 1 8 "RC1" "RC" 1 10 "B9" "B" 1
```

## OSC Array Structure

```
/garden/objects <count> <id1> <loc1> <type1> <action1> <id2> <loc2> <type2> <action2> ...
                 └─┬─┘  └───────────┬───────────┘  └───────────┬───────────┘
                   │                │                           │
                Number of       Object 1 data             Object 2 data
                 objects      (4 parameters)            (4 parameters)
```

## Example with Real Data

**Sending 5 objects:**
```
/garden/objects 5 
  1 "M2" "M" 1      ← Add HandButterfly at M2
  3 "B4" "B" 1      ← Add BreadHead at B4
  6 "B7" "B" 1      ← Add TreeHole at B7
  8 "RC1" "RC" 1    ← Add LobsterKey at RC1
  10 "B9" "B" 1     ← Add Giraffe+Tire at B9
```

**Total arguments:** 1 + (5 × 4) = 21 arguments

## How to See the Array

### 1. Server Console
When you run "Set Entire Garden", the console shows:
```
📤 OSC ARRAY SENT to /garden/objects:
   Count: 5 objects
   Data: [
  {
    "objectId": "1",
    "location": "M2",
    "locationType": "M",
    "action": "ADD"
  },
  ...
]
   Raw OSC Args Count: 21 (1 count + 20 object params)
```

### 2. Web UI
After clicking "Set Entire Garden", you'll see a blue box titled:
**"📤 OSC Array Sent"** with the complete array in JSON format.

### 3. API Response
The response includes an `oscData` field:
```json
{
  "oscData": {
    "sent": true,
    "address": "/garden/objects",
    "count": 5,
    "array": [...]
  }
}
```

## For Your Unreal Engine Connector

### What to Listen For
- **Address:** `/garden/objects` (plural)
- **Port:** 8001

### How to Parse

```
1. Read arg[0] as integer → count
2. For i = 0 to count-1:
     index = 1 + (i * 4)
     objectId = arg[index] (integer)
     location = arg[index+1] (string)
     locationType = arg[index+2] (string)
     action = arg[index+3] (integer: 1=add, 0=remove)
```

### Pseudocode
```cpp
if (message.address == "/garden/objects")
{
    int count = message.GetInt(0);
    
    for (int i = 0; i < count; i++)
    {
        int idx = 1 + (i * 4);
        int objectId = message.GetInt(idx);
        string location = message.GetString(idx + 1);
        string locationType = message.GetString(idx + 2);
        int action = message.GetInt(idx + 3);
        
        if (action == 1)
            AddObject(objectId, location, locationType);
        else
            RemoveObject(objectId, location, locationType);
    }
}
```

## Testing

### Quick Test
1. Start the server: `node app.js`
2. Open browser: `http://localhost:4000`
3. Select "Small Garden (5 objects)"
4. Click "🌱 Set Entire Garden"
5. Check console for OSC array output
6. Check web UI for OSC array display

### Command Line Test
```bash
node test-set-garden.js small
```

You'll see:
```
📤 OSC Array Sent:
   Address: /garden/objects
   Count: 5 objects
   Array: [full JSON array]
```

## Why Array Format?

✅ **Performance:** Single UDP packet vs multiple
✅ **Reliability:** No chance of messages arriving out of order
✅ **Atomicity:** Process all objects as one batch operation
✅ **Efficiency:** Unreal Engine can batch-spawn objects
✅ **Clarity:** Clear that this is a batch operation

## Need More Info?

- **Full OSC Format:** See `documentation/osc-array-format.md`
- **Unreal Integration:** See Blueprint/C++ examples in the doc
- **Test Cases:** See `documentation/test-cases-guide.md`
- **Complete Summary:** See `IMPLEMENTATION_SUMMARY.md`

## Quick Comparison

| Feature | Old (Individual) | New (Array) |
|---------|------------------|-------------|
| Messages for 5 objects | 5 separate | 1 single |
| Order guarantee | No | Yes |
| UDP packets | 5 | 1 |
| Network efficiency | Low | High |
| Batch processing | No | Yes |
| Address | `/garden/object` | `/garden/objects` |

