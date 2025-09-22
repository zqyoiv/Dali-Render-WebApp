# Dali Dream Garden - Object Management Logic

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
