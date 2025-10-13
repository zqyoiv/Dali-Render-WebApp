# Dali Dream Garden - Object Management Logic

## Overview

This web application manages a dream garden installation for the Dali Render project. It handles object placement, removal, and communicates with the rendering system via OSC (Open Sound Control) messages.

## 🔒 Singleton Garden State

**Important**: This application maintains **ONE single garden state** (singleton pattern) that is consistent across ALL operations:

- ✅ Adding objects via UI
- ✅ Adding objects via WebSocket (from other apps)  
- ✅ Batch operations (Set Entire Garden)
- ✅ All synced with Unreal Engine via OSC

**All changes are cumulative** - each operation builds on the previous state unless you explicitly clear the garden. This ensures your Unreal Engine always has the correct, consistent state.

📖 See **[Singleton State Documentation](SINGLETON_STATE_QUICK_REFERENCE.md)** for complete details.

## Garden State Management

The garden can hold a maximum of **22 objects** with intelligent placement and removal logic.

### Adding Objects

When adding an object to the garden:

1. **Check for duplicates** - If the object already exists, remove it first
2. **Find valid locations** - Check object's allowed location types (M, B, RM, RC, H)
3. **Place object** using one of these strategies:

#### Placement Strategies (in order of priority):

1. **Normal Placement**: Place in any available valid location
2. **Capacity Management**: If garden is full (22 objects), remove the oldest object first
3. **Forced Placement**: If no valid locations are available, randomly select a valid location and displace the object currently there

### Removal Reasons

Objects can be removed for three reasons:

- **`duplicate`**: Same object already exists in garden
- **`oldest`**: Garden at capacity, oldest object removed to make room
- **`forced_displacement`**: No available locations, random object displaced

### Data Structure

The garden maintains:
- `objects[]`: Array of object IDs currently in garden
- `locations[]`: Array of corresponding location IDs  
- `addingOrder[]`: Chronological order of additions (oldest first)

### Location Types

- **M**: Main area (M1-M6)
- **B**: Background area (B1-B10) 
- **RM**: Right margin (RM1-RM2)
- **RC**: Right corner (RC1-RC2)
- **H**: Header area (H1-H2)

Each object has predefined valid location types where it can be placed.

## Features

### 1. Single Object Addition
Add individual objects to the garden through the web interface or API.

**Web Interface**: Enter object ID (1-30) and click "Add Object"

**API**: `POST /add/:number`

### 2. Batch Object Addition (Set Entire Garden)
Add multiple objects in a single operation with predefined test cases.

**Test Cases Available**:
- **Small Garden**: 5 objects for basic testing
- **Medium Garden**: 12 objects with varied placement
- **Large Garden**: 18 objects near capacity
- **Full Garden**: 22 objects (maximum capacity)
- **Diverse Mix**: 15 objects covering all location types

**Web Interface**: Select test case and click "Set Entire Garden"

**API**: `POST /set-garden` with body:
```json
{
  "clearFirst": true,
  "objectIds": [1, 2, 3, 5, 7, 10]
}
```

### 3. Garden Management
- **Clear Garden**: Remove all objects at once
- **Garden Monitor**: Real-time view of garden state with auto-refresh
- **OSC Integration**: All operations send OSC messages to port 8001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Web interface |
| GET | `/garden-state` | Get current garden state |
| GET | `/last-data` | Get last extracted objectId and sessionId |
| POST | `/add/:number` | Add single object |
| POST | `/set-garden` | Batch add multiple objects |
| POST | `/clear-garden` | Clear all objects |

## Getting Started

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
# or
node app.js
```

Server runs on `http://localhost:4000`

### Testing

Run the automated test script:

```bash
# Test with small garden (default)
node test-set-garden.js

# Test with specific test case
node test-set-garden.js medium
node test-set-garden.js full
node test-set-garden.js diverse
```

## Documentation

- **[Singleton State Quick Reference](SINGLETON_STATE_QUICK_REFERENCE.md)** - ⭐ START HERE - How the single garden state works
- **[Singleton State Details](documentation/singleton-garden-state.md)** - Complete technical documentation
- **[OSC Array Format](documentation/osc-array-format.md)** - OSC message format for Unreal Engine
- **[Test Cases Guide](documentation/test-cases-guide.md)** - Comprehensive guide for batch object addition
- **[Dali Swimlanes](documentation/dali-swimlanes.md)** - System architecture diagram

## OSC Communication

All object additions and removals send OSC messages:

**Address**: `/garden/object`

**Arguments**:
1. Object ID (integer)
2. Location ID (string, e.g., "M1", "B3")
3. Location Type (string, e.g., "M", "B")
4. Action (integer, 1=add, 0=remove)

**OSC Configuration**:
- Local Address: 127.0.0.1
- Local Port: 57121
- Remote Address: 127.0.0.1
- Remote Port: 8001

## WebSocket Integration

The app connects to a WebSocket relay to receive commands:

- Relay URL: `wss://dali-react-garden.onrender.com/`
- Supports `/add/:objectId/session/:sessionId` commands
- Supports `/check-garden/:objectId` commands

## Project Structure

```
Dali-Render-WebApp/
├── app.js                          # Main Express server
├── object-manage/
│   ├── object-manager.js           # Garden state management
│   ├── object-location-data.js     # Object and location definitions
│   └── osc-sender.js               # OSC message handling
├── public/
│   ├── index.html                  # Web interface
│   └── test-socketio.html          # Socket.io test page
├── documentation/
│   ├── test-cases-guide.md         # Test cases documentation
│   └── dali-swimlanes.md           # Architecture diagram
├── test-set-garden.js              # Automated test script
└── README.md                       # This file
```
