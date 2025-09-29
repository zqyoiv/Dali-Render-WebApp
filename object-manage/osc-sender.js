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
    getLocationTypeFromId
};
