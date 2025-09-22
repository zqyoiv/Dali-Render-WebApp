const { LocationData, ObjectLocationData } = require('./object-location-data');

let GardenData = {
    objects: [], // max 22 object ids, for example: ["1", "2"]
    locations: [], // max 22 location ids, for example: ["M1", "RC1"]
    addingOrder: [] // tracks the order objects were added, oldest first
};

function addObject(objectId) {
    // Convert objectId to string for consistency
    const objId = objectId.toString();
    
    // Check if object exists in ObjectLocationData
    if (!ObjectLocationData[objId]) {
        return {
            success: false,
            message: `Object ${objId} not found in database`
        };
    }
    
    const objectData = ObjectLocationData[objId];
    
    // Check for existence and remove if duplicate
    let removedObject = null;
    const existingIndex = GardenData.objects.indexOf(objId);
    if (existingIndex !== -1) {
        // Store info about removed object
        removedObject = {
            id: objId,
            name: objectData.name,
            location: GardenData.locations[existingIndex],
            reason: 'duplicate'
        };
        // Remove existing object and its location
        GardenData.objects.splice(existingIndex, 1);
        GardenData.locations.splice(existingIndex, 1);
        // Remove from adding order as well
        const orderIndex = GardenData.addingOrder.indexOf(objId);
        if (orderIndex !== -1) {
            GardenData.addingOrder.splice(orderIndex, 1);
        }
    }
    
    // Get all possible locations for this object
    const validLocationTypes = objectData.location;
    let possibleLocations = [];
    
    // Build list of all possible specific locations
    validLocationTypes.forEach(locationType => {
        if (LocationData[locationType]) {
            possibleLocations = possibleLocations.concat(LocationData[locationType]);
        }
    });
    
    // Remove already occupied locations
    const availableLocations = possibleLocations.filter(location => 
        !GardenData.locations.includes(location)
    );
    
    // Check if there are any available locations
    if (availableLocations.length === 0) {
        // No available locations - force placement by removing an existing object
        // Randomly select from all possible locations for this object
        const randomLocationIndex = Math.floor(Math.random() * possibleLocations.length);
        const forcedLocation = possibleLocations[randomLocationIndex];
        
        // Find what object is currently at this location
        const occupiedIndex = GardenData.locations.indexOf(forcedLocation);
        if (occupiedIndex !== -1) {
            const displacedObjectId = GardenData.objects[occupiedIndex];
            const displacedObjectData = ObjectLocationData[displacedObjectId];
            
            // Store info about the displaced object (only if it's not the same as what we removed)
            if (!removedObject || removedObject.id !== displacedObjectId) {
                removedObject = {
                    id: displacedObjectId,
                    name: displacedObjectData.name,
                    location: forcedLocation,
                    reason: 'forced_displacement'
                };
            }
            
            // Remove the displaced object
            GardenData.objects.splice(occupiedIndex, 1);
            GardenData.locations.splice(occupiedIndex, 1);
            // Remove from adding order as well
            const orderIndex = GardenData.addingOrder.indexOf(displacedObjectId);
            if (orderIndex !== -1) {
                GardenData.addingOrder.splice(orderIndex, 1);
            }
        }
        
        // Use the forced location
        availableLocations.push(forcedLocation);
    }
    
    // Check if garden is at capacity (max 22 objects) and no duplicate was removed
    if (GardenData.objects.length >= 22 && !removedObject) {
        // Garden is full and no duplicate - remove oldest object
        const oldestObjectId = GardenData.addingOrder[0]; // first item is oldest
        const oldestIndex = GardenData.objects.indexOf(oldestObjectId);
        
        if (oldestIndex !== -1) {
            // Store info about removed oldest object
            const oldestObjectData = ObjectLocationData[oldestObjectId];
            removedObject = {
                id: oldestObjectId,
                name: oldestObjectData.name,
                location: GardenData.locations[oldestIndex],
                reason: 'oldest'
            };
            
            // Remove oldest object
            GardenData.objects.splice(oldestIndex, 1);
            GardenData.locations.splice(oldestIndex, 1);
            GardenData.addingOrder.shift(); // remove first (oldest) item
        }
    }
    
    // Randomly select a location from available locations
    const randomIndex = Math.floor(Math.random() * availableLocations.length);
    const selectedLocation = availableLocations[randomIndex];
    
    // Add object and location to garden state
    GardenData.objects.push(objId);
    GardenData.locations.push(selectedLocation);
    // Add to adding order (newest at the end)
    GardenData.addingOrder.push(objId);
    
    // Create added object info
    const addedObject = {
        id: objId,
        name: objectData.name,
        location: selectedLocation
    };

    return {
        success: true,
        objectName: objectData.name,
        location: selectedLocation,
        removedObject: removedObject,
        addedObject: addedObject,
        gardenState: {
            objects: [...GardenData.objects],
            locations: [...GardenData.locations],
            addingOrder: [...GardenData.addingOrder]
        }
    };
}

function getGardenState() {
    return {
        objects: [...GardenData.objects],
        locations: [...GardenData.locations],
        addingOrder: [...GardenData.addingOrder]
    };
}

function clearGarden() {
    GardenData.objects = [];
    GardenData.locations = [];
    GardenData.addingOrder = [];
    return getGardenState();
}

module.exports = {
    addObject,
    getGardenState,
    clearGarden
};