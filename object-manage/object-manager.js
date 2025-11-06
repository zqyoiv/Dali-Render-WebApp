const { LocationData, ObjectLocationData, PrioritizedPositionMap } = require('./object-location-data');
const { sendObjectEvent, getLocationTypeFromId } = require('./osc-sender');

/**
 * DALI DREAM GARDEN - OBJECT MANAGER
 * 
 * This module manages the placement and removal of objects in the Dali Dream Garden.
 * It implements a sophisticated priority-based placement system with forced displacement
 * capabilities to maintain garden capacity limits.
 * 
 * ================================================================================
 * ADD OBJECT LOGIC - STEP BY STEP PROCESS
 * ================================================================================
 * 
 * When adding a new object to the garden, the system follows this detailed process:
 * 
 * 1. VALIDATION PHASE
 *    - Convert objectId to string for consistency
 *    - Check if object exists in ObjectLocationData database
 *    - Return error if object not found
 * 
 * 2. DUPLICATE HANDLING PHASE
 *    - Check if object already exists in garden
 *    - If duplicate found:
 *      * Store info about removed object (reason: 'duplicate')
 *      * Remove existing object and its location from garden state
 *      * Remove from adding order tracking
 *      * Send OSC removal message for the duplicate
 * 
 * 3. LOCATION ANALYSIS PHASE
 *    - Get valid location types for the object from ObjectLocationData
 *    - Check PrioritizedPositionMap for priority location type
 *    - Split locations into:
 *      * Prioritized locations (e.g., M1-M6 for M-prioritized objects)
 *      * Fallback locations (other valid locations like B, RM, RC, H)
 *    - Filter out already occupied locations from both lists
 * 
 * 4. AVAILABILITY CHECK PHASE
 *    - Combine available prioritized and fallback locations
 *    - If NO locations available → proceed to FORCED DISPLACEMENT
 *    - If locations available → proceed to NORMAL PLACEMENT
 * 
 * 5A. FORCED DISPLACEMENT PHASE (when no locations available)
 *     - Prioritize displacing from occupied prioritized locations first
 *     - If no prioritized locations occupied → displace from any location
 *     - Find object currently at the target location
 *     - Store displacement info (reason: 'forced_displacement')
 *     - Remove displaced object from garden state
 *     - Send OSC removal message for displaced object
 *     - Add target location to available locations
 * 
 * 5B. CAPACITY MANAGEMENT PHASE (garden at max 22 objects)
 *     - If garden is full and no duplicate was removed:
 *       * Find oldest object (first in addingOrder array)
 *       * Store removal info (reason: 'oldest')
 *       * Remove oldest object from garden state
 *       * Send OSC removal message for oldest object
 * 
 * 6. LOCATION SELECTION PHASE
 *    - If prioritized locations available → randomly select from prioritized
 *    - If no prioritized locations → randomly select from fallback locations
 *    - Log selection type (prioritized vs fallback)
 * 
 * 7. PLACEMENT PHASE
 *    - Add object and selected location to garden state
 *    - Add object to adding order (newest at end)
 *    - Send OSC addition message
 *    - Update state metadata (version, timestamp)
 * 
 * 8. RESPONSE PHASE
 *    - Return success response with:
 *      * Added object info (id, name, location)
 *      * Removed object info (if any)
 *      * Complete garden state snapshot
 * 
 * ================================================================================
 * KEY FEATURES
 * ================================================================================
 * 
 * - PRIORITY SYSTEM: Objects in PrioritizedPositionMap prefer specific location types
 * - SMART DISPLACEMENT: Prioritizes removing objects from priority locations first
 * - CAPACITY MANAGEMENT: Maintains max 22 objects by removing oldest when full
 * - DUPLICATE HANDLING: Automatically removes duplicates before adding new instance
 * - STATE CONSISTENCY: Single source of truth for garden state across all operations
 * - OSC INTEGRATION: Sends real-time messages to Unreal Engine for visual updates
 * 
 * ================================================================================
 * SINGLETON GARDEN STATE
 * ================================================================================
 * This is the single source of truth for the garden state across the entire application.
 * All operations (batch, single, WebSocket) modify this same state.
 * This ensures consistency with Unreal Engine regardless of how objects are added.
 */
let GardenData = {
    objects: [], // max 22 object ids, for example: ["1", "2"]
    locations: [], // max 22 location ids, for example: ["M1", "RC1"]
    addingOrder: [], // tracks the order objects were added, oldest first
    objectTimestamps: {}, // tracks creation timestamp for each object: {objectId: timestamp}
    stateVersion: 0, // increments with each state change (for tracking)
    lastModified: Date.now() // timestamp of last modification
};

/**
 * Inactivity timer for auto-cleanup
 */
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Update state metadata after any modification
 */
function updateStateMetadata() {
    GardenData.stateVersion++;
    GardenData.lastModified = Date.now();
    console.log(`🔄 Garden State Updated - Version: ${GardenData.stateVersion}, Objects: ${GardenData.objects.length}/22`);
    
    // Reset inactivity timer
    resetInactivityTimer();
}

/**
 * Reset the inactivity timer - called whenever there's activity
 */
function resetInactivityTimer() {
    // Clear existing timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Set new timer - only if we have objects in the garden
    if (GardenData.objects.length > 0) {
        inactivityTimer = setTimeout(() => {
            console.log(`⏰ 5 minutes of inactivity detected - triggering auto-cleanup`);
            removeOldestHalf();
        }, INACTIVITY_TIMEOUT);
    }
}

/**
 * Remove the oldest half of objects from the garden
 */
function removeOldestHalf() {
    if (GardenData.objects.length === 0) {
        console.log(`🤷 No objects to remove`);
        return;
    }
    
    // Calculate how many to remove (half, rounded down)
    const countToRemove = Math.floor(GardenData.objects.length / 2);
    
    if (countToRemove === 0) {
        console.log(`🤷 Only ${GardenData.objects.length} object(s) in garden - not removing any`);
        return;
    }
    
    console.log(`🗑️ Auto-cleanup: Removing oldest ${countToRemove} of ${GardenData.objects.length} objects`);
    
    // Get the oldest objects from addingOrder
    const objectsToRemove = GardenData.addingOrder.slice(0, countToRemove);
    
    // Remove each object
    const removedObjects = [];
    for (const objId of objectsToRemove) {
        const objectIndex = GardenData.objects.indexOf(objId);
        if (objectIndex !== -1) {
            const location = GardenData.locations[objectIndex];
            const objectData = ObjectLocationData[objId];
            const timestamp = GardenData.objectTimestamps[objId];
            
            // Send OSC removal message
            const locationType = getLocationTypeFromId(location);
            sendObjectEvent(objId, location, locationType, false);
            
            removedObjects.push({
                id: objId,
                name: objectData ? objectData.name : 'Unknown',
                location: location,
                timestamp: timestamp,
                reason: 'auto_cleanup_inactivity'
            });
            
            // Remove from arrays
            GardenData.objects.splice(objectIndex, 1);
            GardenData.locations.splice(objectIndex, 1);
            
            // Remove timestamp
            delete GardenData.objectTimestamps[objId];
        }
    }
    
    // Remove from addingOrder
    GardenData.addingOrder = GardenData.addingOrder.slice(countToRemove);
    
    // Update state metadata (this will NOT restart the timer since we're in cleanup)
    GardenData.stateVersion++;
    GardenData.lastModified = Date.now();
    console.log(`✅ Auto-cleanup complete: Removed ${removedObjects.length} objects. Garden now has ${GardenData.objects.length} objects`);
    
    // Don't restart the timer after auto-cleanup - let it naturally restart on next activity
    return {
        success: true,
        removedCount: removedObjects.length,
        removedObjects: removedObjects,
        gardenState: getGardenState()
    };
}

/**
 * Get prioritized locations for an object based on the prioritized position map
 * @param {string} objectId - The object ID to get prioritized locations for
 * @param {Array} validLocationTypes - Array of valid location types for this object
 * @returns {Array} Array of prioritized locations
 */
function getPrioritizedLocations(objectId, validLocationTypes) {
    let prioritizedLocations = [];
    let fallbackLocations = [];
    
    // Check if this object has a prioritized location type
    const prioritizedType = PrioritizedPositionMap[objectId];
    
    if (prioritizedType) {
        console.log(`🎯 Object ${objectId} has prioritized location type: ${prioritizedType}`);
        
        // Get locations of the prioritized type
        if (LocationData[prioritizedType]) {
            prioritizedLocations = LocationData[prioritizedType];
        }
        
        // Get fallback locations from valid location types (excluding prioritized type)
        validLocationTypes.forEach(locationType => {
            if (locationType !== prioritizedType && LocationData[locationType]) {
                fallbackLocations = fallbackLocations.concat(LocationData[locationType]);
            }
        });
    } else {
        // No prioritization - use all valid location types
        validLocationTypes.forEach(locationType => {
            if (LocationData[locationType]) {
                fallbackLocations = fallbackLocations.concat(LocationData[locationType]);
            }
        });
    }
    
    return {
        prioritized: prioritizedLocations,
        fallback: fallbackLocations
    };
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
        // Remove timestamp
        delete GardenData.objectTimestamps[objId];
        
        // Send OSC message for removal
        const locationType = getLocationTypeFromId(removedObject.location);
        sendObjectEvent(objId, removedObject.location, locationType, false);
    }
    
    // Get prioritized locations for this object
    const validLocationTypes = objectData.location;
    const { prioritized: prioritizedLocations, fallback: fallbackLocations } = getPrioritizedLocations(objId, validLocationTypes);
    
    // Remove already occupied locations from prioritized locations first
    const availablePrioritizedLocations = prioritizedLocations.filter(location => 
        !GardenData.locations.includes(location)
    );
    
    // Remove already occupied locations from fallback locations
    const availableFallbackLocations = fallbackLocations.filter(location => 
        !GardenData.locations.includes(location)
    );
    
    // Combine prioritized and fallback locations (prioritized first)
    const availableLocations = [...availablePrioritizedLocations, ...availableFallbackLocations];
    
    // For forced placement, we need all possible locations
    const allPossibleLocations = [...prioritizedLocations, ...fallbackLocations];
    
    // Check if there are any available locations
    if (availableLocations.length === 0) {
        // No available locations - force placement by removing an existing object
        // Prioritize displacing from prioritized locations first, then fallback locations
        let forcedLocation;
        
        // First, try to find occupied prioritized locations
        const occupiedPrioritizedLocations = prioritizedLocations.filter(location => 
            GardenData.locations.includes(location)
        );
        
        if (occupiedPrioritizedLocations.length > 0) {
            // Randomly select from occupied prioritized locations
            const randomIndex = Math.floor(Math.random() * occupiedPrioritizedLocations.length);
            forcedLocation = occupiedPrioritizedLocations[randomIndex];
            console.log(`🎯 Forced displacement: targeting prioritized location ${forcedLocation} for object ${objId}`);
        } else {
            // No prioritized locations occupied, randomly select from all possible locations
            const randomLocationIndex = Math.floor(Math.random() * allPossibleLocations.length);
            forcedLocation = allPossibleLocations[randomLocationIndex];
            console.log(`📍 Forced displacement: targeting fallback location ${forcedLocation} for object ${objId}`);
        }
        
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
            // Remove timestamp
            delete GardenData.objectTimestamps[displacedObjectId];
            
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
            // Remove timestamp
            delete GardenData.objectTimestamps[oldestObjectId];
            
            // Send OSC message for oldest removal
            const locationType = getLocationTypeFromId(removedObject.location);
            sendObjectEvent(oldestObjectId, removedObject.location, locationType, false);
        }
    }
    
    // Select location with priority: prefer prioritized locations if available
    let selectedLocation;
    if (availablePrioritizedLocations.length > 0) {
        // Randomly select from prioritized locations
        const randomIndex = Math.floor(Math.random() * availablePrioritizedLocations.length);
        selectedLocation = availablePrioritizedLocations[randomIndex];
        console.log(`🎯 Selected prioritized location ${selectedLocation} for object ${objId}`);
    } else {
        // Fall back to any available location
        const randomIndex = Math.floor(Math.random() * availableLocations.length);
        selectedLocation = availableLocations[randomIndex];
        console.log(`📍 Selected fallback location ${selectedLocation} for object ${objId}`);
    }
    
    // Add object and location to garden state
    GardenData.objects.push(objId);
    GardenData.locations.push(selectedLocation);
    // Add to adding order (newest at the end)
    GardenData.addingOrder.push(objId);
    // Track creation timestamp
    GardenData.objectTimestamps[objId] = Date.now();
    
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
        objectTimestamps: { ...GardenData.objectTimestamps },
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
    
    // Remove timestamp
    delete GardenData.objectTimestamps[objId];
    
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
    GardenData.objectTimestamps = {};
    
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
        GardenData.objectTimestamps = {};
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
            // Remove timestamp
            delete GardenData.objectTimestamps[objId];
        }
        
        // Get prioritized locations for this object
        const validLocationTypes = objectData.location;
        const { prioritized: prioritizedLocations, fallback: fallbackLocations } = getPrioritizedLocations(objId, validLocationTypes);
        
        // Remove already occupied locations from prioritized locations first
        const availablePrioritizedLocations = prioritizedLocations.filter(location => 
            !GardenData.locations.includes(location)
        );
        
        // Remove already occupied locations from fallback locations
        const availableFallbackLocations = fallbackLocations.filter(location => 
            !GardenData.locations.includes(location)
        );
        
        // Combine prioritized and fallback locations (prioritized first)
        const availableLocations = [...availablePrioritizedLocations, ...availableFallbackLocations];
        
        // For forced placement, we need all possible locations
        const allPossibleLocations = [...prioritizedLocations, ...fallbackLocations];
        
        // Check if locations available
        if (availableLocations.length === 0) {
            // Force placement - prioritize displacing from prioritized locations first
            let forcedLocation;
            
            // First, try to find occupied prioritized locations
            const occupiedPrioritizedLocations = prioritizedLocations.filter(location => 
                GardenData.locations.includes(location)
            );
            
            if (occupiedPrioritizedLocations.length > 0) {
                // Randomly select from occupied prioritized locations
                const randomIndex = Math.floor(Math.random() * occupiedPrioritizedLocations.length);
                forcedLocation = occupiedPrioritizedLocations[randomIndex];
                console.log(`🎯 Batch forced displacement: targeting prioritized location ${forcedLocation} for object ${objId}`);
            } else {
                // No prioritized locations occupied, randomly select from all possible locations
                const randomLocationIndex = Math.floor(Math.random() * allPossibleLocations.length);
                forcedLocation = allPossibleLocations[randomLocationIndex];
                console.log(`📍 Batch forced displacement: targeting fallback location ${forcedLocation} for object ${objId}`);
            }
            
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
                // Remove timestamp
                delete GardenData.objectTimestamps[displacedObjectId];
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
                // Remove timestamp
                delete GardenData.objectTimestamps[oldestObjectId];
            }
        }
        
        // Select location with priority: prefer prioritized locations if available
        let selectedLocation;
        if (availablePrioritizedLocations.length > 0) {
            // Randomly select from prioritized locations
            const randomIndex = Math.floor(Math.random() * availablePrioritizedLocations.length);
            selectedLocation = availablePrioritizedLocations[randomIndex];
            console.log(`🎯 Batch: Selected prioritized location ${selectedLocation} for object ${objId}`);
        } else {
            // Fall back to any available location
            const randomIndex = Math.floor(Math.random() * availableLocations.length);
            selectedLocation = availableLocations[randomIndex];
            console.log(`📍 Batch: Selected fallback location ${selectedLocation} for object ${objId}`);
        }
        const selectedLocationType = getLocationTypeFromId(selectedLocation);
        
        // Add to garden
        GardenData.objects.push(objId);
        GardenData.locations.push(selectedLocation);
        GardenData.addingOrder.push(objId);
        // Track creation timestamp
        GardenData.objectTimestamps[objId] = Date.now();
        
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

/**
 * Initialize garden on startup: clear via OSC and add 12 default objects
 * This ensures the garden starts with a known state
 */
function initializeGarden() {
    console.log(`\n🌱 Initializing garden on startup...`);
    
    // Clear the garden (sends OSC removal messages for any existing objects)
    clearGarden();
    
    // Add 6 default objects: lobster telephone, palm butterfly, bread head, egg eye, thumb, face drawer
    const defaultObjects = ["18", "1", "3", "16", "15", "4"]; // LobsterSaxophone, HandButterfly, BreadHead, EggEye, ThumbClock, HeadDrawer
    console.log(`   Adding ${defaultObjects.length} default objects...`);
    
    // Use existing batch add function (don't clear again, we already did)
    const batchResult = addObjectsBatch(defaultObjects, false);
    
    // Send OSC array message for all added objects
    const { sendObjectArrayEvent } = require('./osc-sender');
    const oscResult = sendObjectArrayEvent(batchResult.oscArray);
    
    console.log(`✅ Garden initialized with ${batchResult.summary.successful} objects`);
    console.log(`   Final State - Version: ${batchResult.gardenState.stateVersion}, Objects: ${batchResult.gardenState.objects.length}/22\n`);
    
    return {
        success: true,
        message: `Garden initialized with ${batchResult.summary.successful} objects`,
        gardenState: batchResult.gardenState,
        oscSent: oscResult.success
    };
}

module.exports = {
    addObject,
    removeObject,
    getGardenState,
    clearGarden,
    addObjectsBatch,
    initializeGarden,
    removeOldestHalf
};