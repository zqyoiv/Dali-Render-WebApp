const osc = require('osc');

// Create OSC UDP Port for sending messages
const oscPort = new osc.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 57121,
    remoteAddress: "127.0.0.1",
    remotePort: 8001,
    metadata: true
});

// Open the port
oscPort.open();

// Handle port ready event
oscPort.on("ready", function () {
    console.log("OSC client ready - sending to port 8001");
});

// Handle errors
oscPort.on("error", function (error) {
    console.log("OSC Error: ", error.message);
});

/**
 * Send OSC message for object add/remove events
 * @param {string} objectId - The object ID 
 * @param {string} locationId - The location ID (e.g., "M1", "B3")
 * @param {string} locationType - The location type (e.g., "M", "B", "RM")
 * @param {boolean} isAdd - True if adding object, false if removing
 */
function sendObjectEvent(objectId, locationId, locationType, isAdd) {
    try {
        const message = {
            address: "/garden/object",
            args: [
                {
                    type: "i", // integer
                    value: parseInt(objectId)
                },
                {
                    type: "s", // string
                    value: locationId
                },
                {
                    type: "s", // string
                    value: locationType
                },
                {
                    type: "i", // integer (1 for add, 0 for remove)
                    value: isAdd ? 1 : 0
                }
            ]
        };

        oscPort.send(message);
        
        console.log(`OSC sent: Object ${objectId} ${isAdd ? 'ADD' : 'REMOVE'} at ${locationId} (${locationType})`);
        
    } catch (error) {
        console.error("Error sending OSC message:", error.message);
    }
}

/**
 * Send OSC message with array of objects (for batch operations)
 * @param {Array} objectsArray - Array of objects with structure: 
 *   [{ objectId, locationId, locationType, isAdd }, ...]
 * @returns {Object} - The array data that was sent
 */
function sendObjectArrayEvent(objectsArray) {
    try {
        if (!Array.isArray(objectsArray) || objectsArray.length === 0) {
            console.log('⚠️ No objects to send via OSC');
            return { success: false, array: [] };
        }

        // Build OSC message with array of objects
        // Format: /garden/objects [count] [obj1_id, obj1_loc, obj1_type, obj1_action, obj2_id, obj2_loc, ...]
        const args = [
            {
                type: "i", // integer - number of objects
                value: objectsArray.length
            }
        ];

        // Add each object's data to the args array
        objectsArray.forEach(obj => {
            args.push(
                {
                    type: "i", // integer - object ID
                    value: parseInt(obj.objectId)
                },
                {
                    type: "s", // string - location ID
                    value: obj.locationId
                },
                {
                    type: "s", // string - location type
                    value: obj.locationType
                },
                {
                    type: "i", // integer - action (1=add, 0=remove)
                    value: obj.isAdd ? 1 : 0
                }
            );
        });

        const message = {
            address: "/garden/objects", // Note: plural "objects" for batch
            args: args
        };

        oscPort.send(message);

        // Create a readable array for logging
        const readableArray = objectsArray.map(obj => ({
            objectId: obj.objectId,
            location: obj.locationId,
            locationType: obj.locationType,
            action: obj.isAdd ? 'ADD' : 'REMOVE'
        }));

        console.log(`\n📤 OSC ARRAY SENT to /garden/objects:`);
        console.log(`   Count: ${objectsArray.length} objects`);
        console.log(`   Data:`, JSON.stringify(readableArray, null, 2));
        console.log(`   Raw OSC Args Count: ${args.length} (1 count + ${objectsArray.length * 4} object params)\n`);

        return {
            success: true,
            array: readableArray,
            count: objectsArray.length,
            oscAddress: "/garden/objects"
        };

    } catch (error) {
        console.error("❌ Error sending OSC array message:", error.message);
        return {
            success: false,
            error: error.message,
            array: []
        };
    }
}

/**
 * Extract location type from location ID
 * @param {string} locationId - Location ID like "M1", "RM2", etc.
 * @returns {string} - Location type like "M", "RM", etc.
 */
function getLocationTypeFromId(locationId) {
    // Extract alphabetic prefix (e.g., "M1" -> "M", "RM2" -> "RM")
    const match = locationId.match(/^([A-Z]+)/);
    return match ? match[1] : locationId;
}

module.exports = {
    sendObjectEvent,
    sendObjectArrayEvent,
    getLocationTypeFromId
};
