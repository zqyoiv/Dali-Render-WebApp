const { LocationData, ObjectLocationData } = require('./object-location-data');
const { sendObjectEvent, getLocationTypeFromId } = require('./osc-sender');

/**
 * SINGLETON GARDEN STATE
 * This is the single source of truth for the garden state across the entire application.
 * All operations (batch, single, WebSocket) modify this same state.
 * This ensures consistency with Unreal Engine regardless of how objects are added.
 */
let GardenData = {
    objects: [], // max 22 object ids, for example: ["1", "2"]
    locations: [], // max 22 location ids, for example: ["M1", "RC1"]
    addingOrder: [], // tracks the order objects were added, oldest first
    stateVersion: 0, // increments with each state change (for tracking)
    lastModified: Date.now() // timestamp of last modification
};

/**
 * Update state metadata after any modification
 */
function updateStateMetadata() {
    GardenData.stateVersion++;
    GardenData.lastModified = Date.now();
    console.log(`🔄 Garden State Updated - Version: ${GardenData.stateVersion}, Objects: ${GardenData.objects.length}/22`);
}

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
        
        // Send OSC message for removal
        const locationType = getLocationTypeFromId(removedObject.location);
        sendObjectEvent(objId, removedObject.location, locationType, false);
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
            
            // Send OSC message for forced displacement removal
            const locationType = getLocationTypeFromId(forcedLocation);
            sendObjectEvent(displacedObjectId, forcedLocation, locationType, false);
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
            
            // Send OSC message for oldest removal
            const locationType = getLocationTypeFromId(removedObject.location);
            sendObjectEvent(oldestObjectId, removedObject.location, locationType, false);
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
    
    // Send OSC message for addition
    const addLocationType = getLocationTypeFromId(selectedLocation);
    sendObjectEvent(objId, selectedLocation, addLocationType, true);
    
    // Update state metadata
    updateStateMetadata();
    
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
            addingOrder: [...GardenData.addingOrder],
            stateVersion: GardenData.stateVersion,
            lastModified: GardenData.lastModified
        }
    };
}

function getGardenState() {
    return {
        objects: [...GardenData.objects],
        locations: [...GardenData.locations],
        addingOrder: [...GardenData.addingOrder],
        stateVersion: GardenData.stateVersion,
        lastModified: GardenData.lastModified
    };
}

function removeObject(objectId) {
    // Convert objectId to string for consistency
    const objId = objectId.toString();
    
    // Find object in garden
    const objectIndex = GardenData.objects.indexOf(objId);
    
    if (objectIndex === -1) {
        return {
            success: false,
            message: `Object ${objId} not found in garden`
        };
    }
    
    // Get object data and location
    const location = GardenData.locations[objectIndex];
    const objectData = ObjectLocationData[objId];
    
    // Remove from garden state
    GardenData.objects.splice(objectIndex, 1);
    GardenData.locations.splice(objectIndex, 1);
    
    // Remove from adding order
    const orderIndex = GardenData.addingOrder.indexOf(objId);
    if (orderIndex !== -1) {
        GardenData.addingOrder.splice(orderIndex, 1);
    }
    
    // Send OSC message for removal
    const locationType = getLocationTypeFromId(location);
    sendObjectEvent(objId, location, locationType, false);
    
    // Update state metadata
    updateStateMetadata();
    
    console.log(`🗑️ Removed object ${objId} from garden at location ${location}`);
    
    return {
        success: true,
        message: `Object ${objId} removed from garden at location ${location}`,
        removedObject: {
            id: objId,
            name: objectData ? objectData.name : 'Unknown',
            location: location
        },
        gardenState: getGardenState()
    };
}

function clearGarden() {
    // Send OSC removal messages for all objects before clearing
    for (let i = 0; i < GardenData.objects.length; i++) {
        const objectId = GardenData.objects[i];
        const location = GardenData.locations[i];
        const locationType = getLocationTypeFromId(location);
        
        // Send OSC message for removal
        sendObjectEvent(objectId, location, locationType, false);
    }
    
    console.log(`🧹 Cleared ${GardenData.objects.length} objects from garden`);
    
    // Clear all data
    GardenData.objects = [];
    GardenData.locations = [];
    GardenData.addingOrder = [];
    
    // Update state metadata
    updateStateMetadata();
    
    return getGardenState();
}

/**
 * Add multiple objects in batch without sending individual OSC messages
 * Returns array of objects to be sent via OSC as a single array message
 * @param {Array} objectIds - Array of object IDs to add
 * @param {boolean} clearFirst - Whether to clear garden first
 * @returns {Object} - Results with OSC array data
 */
function addObjectsBatch(objectIds, clearFirst = false) {
    const results = [];
    const oscArray = []; // Array to send via OSC
    const addedObjects = [];
    const removedObjects = [];
    let successCount = 0;
    let failCount = 0;
    
    // Clear garden first if requested
    if (clearFirst) {
        // Get objects that will be removed for logging
        for (let i = 0; i < GardenData.objects.length; i++) {
            const objectId = GardenData.objects[i];
            const location = GardenData.locations[i];
            const locationType = getLocationTypeFromId(location);
            const objectData = ObjectLocationData[objectId];
            
            removedObjects.push({
                id: objectId,
                name: objectData ? objectData.name : 'Unknown',
                location: location,
                reason: 'cleared'
            });
            
            // Add to OSC array for removal
            oscArray.push({
                objectId: objectId,
                locationId: location,
                locationType: locationType,
                isAdd: false
            });
        }
        
        console.log(`🧹 Clearing ${GardenData.objects.length} objects from garden (for batch add)`);
        
        // Clear without sending individual OSC messages
        GardenData.objects = [];
        GardenData.locations = [];
        GardenData.addingOrder = [];
    }
    
    // Process each object ID
    for (const objectId of objectIds) {
        const objId = objectId.toString();
        
        // Check if object exists in database
        if (!ObjectLocationData[objId]) {
            results.push({
                success: false,
                message: `Object ${objId} not found in database`,
                objectId: objId
            });
            failCount++;
            continue;
        }
        
        const objectData = ObjectLocationData[objId];
        
        // Check for duplicates (shouldn't happen if clearFirst=true, but check anyway)
        const existingIndex = GardenData.objects.indexOf(objId);
        if (existingIndex !== -1) {
            // Remove existing
            const oldLocation = GardenData.locations[existingIndex];
            const oldLocationType = getLocationTypeFromId(oldLocation);
            
            removedObjects.push({
                id: objId,
                name: objectData.name,
                location: oldLocation,
                reason: 'duplicate'
            });
            
            // Add removal to OSC array
            oscArray.push({
                objectId: objId,
                locationId: oldLocation,
                locationType: oldLocationType,
                isAdd: false
            });
            
            GardenData.objects.splice(existingIndex, 1);
            GardenData.locations.splice(existingIndex, 1);
            const orderIndex = GardenData.addingOrder.indexOf(objId);
            if (orderIndex !== -1) {
                GardenData.addingOrder.splice(orderIndex, 1);
            }
        }
        
        // Get valid locations for this object
        const validLocationTypes = objectData.location;
        let possibleLocations = [];
        
        validLocationTypes.forEach(locationType => {
            if (LocationData[locationType]) {
                possibleLocations = possibleLocations.concat(LocationData[locationType]);
            }
        });
        
        // Remove already occupied locations
        const availableLocations = possibleLocations.filter(location => 
            !GardenData.locations.includes(location)
        );
        
        // Check if locations available
        if (availableLocations.length === 0) {
            // Force placement
            const randomLocationIndex = Math.floor(Math.random() * possibleLocations.length);
            const forcedLocation = possibleLocations[randomLocationIndex];
            
            const occupiedIndex = GardenData.locations.indexOf(forcedLocation);
            if (occupiedIndex !== -1) {
                const displacedObjectId = GardenData.objects[occupiedIndex];
                const displacedObjectData = ObjectLocationData[displacedObjectId];
                const displacedLocationType = getLocationTypeFromId(forcedLocation);
                
                removedObjects.push({
                    id: displacedObjectId,
                    name: displacedObjectData.name,
                    location: forcedLocation,
                    reason: 'forced_displacement'
                });
                
                // Add removal to OSC array
                oscArray.push({
                    objectId: displacedObjectId,
                    locationId: forcedLocation,
                    locationType: displacedLocationType,
                    isAdd: false
                });
                
                GardenData.objects.splice(occupiedIndex, 1);
                GardenData.locations.splice(occupiedIndex, 1);
                const orderIndex = GardenData.addingOrder.indexOf(displacedObjectId);
                if (orderIndex !== -1) {
                    GardenData.addingOrder.splice(orderIndex, 1);
                }
            }
            
            availableLocations.push(forcedLocation);
        }
        
        // Check capacity (max 22)
        if (GardenData.objects.length >= 22) {
            const oldestObjectId = GardenData.addingOrder[0];
            const oldestIndex = GardenData.objects.indexOf(oldestObjectId);
            
            if (oldestIndex !== -1) {
                const oldestObjectData = ObjectLocationData[oldestObjectId];
                const oldestLocation = GardenData.locations[oldestIndex];
                const oldestLocationType = getLocationTypeFromId(oldestLocation);
                
                removedObjects.push({
                    id: oldestObjectId,
                    name: oldestObjectData.name,
                    location: oldestLocation,
                    reason: 'oldest'
                });
                
                // Add removal to OSC array
                oscArray.push({
                    objectId: oldestObjectId,
                    locationId: oldestLocation,
                    locationType: oldestLocationType,
                    isAdd: false
                });
                
                GardenData.objects.splice(oldestIndex, 1);
                GardenData.locations.splice(oldestIndex, 1);
                GardenData.addingOrder.shift();
            }
        }
        
        // Select random available location
        const randomIndex = Math.floor(Math.random() * availableLocations.length);
        const selectedLocation = availableLocations[randomIndex];
        const selectedLocationType = getLocationTypeFromId(selectedLocation);
        
        // Add to garden
        GardenData.objects.push(objId);
        GardenData.locations.push(selectedLocation);
        GardenData.addingOrder.push(objId);
        
        // Add to OSC array
        oscArray.push({
            objectId: objId,
            locationId: selectedLocation,
            locationType: selectedLocationType,
            isAdd: true
        });
        
        addedObjects.push({
            id: objId,
            name: objectData.name,
            location: selectedLocation
        });
        
        results.push({
            success: true,
            message: `Added object ${objId} (${objectData.name}) at ${selectedLocation}`,
            objectId: objId,
            location: selectedLocation
        });
        
        successCount++;
    }
    
    // Update state metadata after batch operation
    updateStateMetadata();
    console.log(`📦 Batch operation complete: ${successCount} added, ${failCount} failed`);
    
    return {
        success: true,
        results: results,
        addedObjects: addedObjects,
        removedObjects: removedObjects,
        summary: {
            total: objectIds.length,
            successful: successCount,
            failed: failCount
        },
        oscArray: oscArray, // This is the array to send via OSC
        gardenState: getGardenState()
    };
}

module.exports = {
    addObject,
    removeObject,
    getGardenState,
    clearGarden,
    addObjectsBatch
};