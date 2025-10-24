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
        // Create a single string with format: "objectId:locationId:locationType:action"
        // Example: "15:M1:N:1" (where 1 = add, 0 = remove)
        const dataString = `${objectId}:${locationId}:${locationType}:${isAdd ? 1 : 0}`;
        
        const message = {
            address: "/garden/object",
            args: [
                {
                    type: "s", // string
                    value: dataString
                }
            ]
        };

        oscPort.send(message);
        
        console.log(`OSC sent: "${dataString}" (Object ${objectId} ${isAdd ? 'ADD' : 'REMOVE'} at ${locationId} ${locationType})`);
        
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

        // Build OSC message with array of strings
        // Each string has format: "objectId:locationId:locationType:action"
        // Example: ["15:M1:N:1", "27:B2:B:0", "33:RM1:RM:1"]
        const args = [];

        // Add each object's data as a single string
        objectsArray.forEach(obj => {
            const dataString = `${obj.objectId}:${obj.locationId}:${obj.locationType}:${obj.isAdd ? 1 : 0}`;
            args.push({
                type: "s", // string
                value: dataString
            });
        });

        const message = {
            address: "/garden/objects", // Note: plural "objects" for batch
            args: args
        };

        oscPort.send(message);

        // Create a readable array for logging
        const readableArray = objectsArray.map(obj => {
            const dataString = `${obj.objectId}:${obj.locationId}:${obj.locationType}:${obj.isAdd ? 1 : 0}`;
            return {
                string: dataString,
                objectId: obj.objectId,
                location: obj.locationId,
                locationType: obj.locationType,
                action: obj.isAdd ? 'ADD' : 'REMOVE'
            };
        });

        console.log(`\n📤 OSC ARRAY SENT to /garden/objects:`);
        console.log(`   Count: ${objectsArray.length} objects`);
        console.log(`   Data:`, JSON.stringify(readableArray, null, 2));
        console.log(`   Raw OSC Args Count: ${args.length} (${objectsArray.length} string params)\n`);

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
