const express = require('express');
const path = require('path');
const { addObject } = require('./object-manage/object-manager');
const { io } = require('socket.io-client');

const app = express();
const PORT = process.env.PORT || 4000;

// Garden configuration
const MAX_GARDEN_OBJECTS = 22;

// WebSocket configuration
// const RELAY_URL = "wss://two025-dali-garden-webapp.onrender.com";
const RELAY_URL = "wss://dali-endless-garden.onrender.com/";
let relaySocket = null;

// Global variables to store extracted data
let lastObjectId = null;
let lastSessionId = null;

// Helper function to get stored values
function getLastExtractedData() {
    return {
        objectId: lastObjectId,
        sessionId: lastSessionId
    };
}

// Helper function to process add object logic and generate response
function processAddObject(objectId, source = 'unknown', sessionId = null) {
    try {
        const sessionInfo = sessionId ? ` (session: ${sessionId})` : '';
        console.log(`Processing add object command for ID: ${objectId} from ${source}${sessionInfo}`);
        const result = addObject(objectId);
        
        if (result.success) {
            let message = '';
            if (result.removedObject) {
                if (result.removedObject.reason === 'duplicate') {
                    message = `Removed duplicate object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                } else if (result.removedObject.reason === 'oldest') {
                    message = `Garden full! Removed oldest object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                } else if (result.removedObject.reason === 'forced_displacement') {
                    message = `No available locations! Forcibly displaced object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                }
            } else {
                message = `Added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
            }
            
            console.log(`✅ ${message}`);
            
            return {
                success: true,
                message: message,
                removedObject: result.removedObject,
                addedObject: result.addedObject,
                gardenState: result.gardenState
            };
        } else {
            console.log(`❌ Failed to add object: ${result.message}`);
            return {
                success: false,
                message: result.message
            };
        }
    } catch (error) {
        const errorMessage = `Error handling add object command: ${error.message}`;
        console.error(`❌ ${errorMessage}`);
        return {
            success: false,
            message: errorMessage
        };
    }
}

// Function to establish WebSocket connection to relay
function connectToRelay() {
    if (relaySocket) {
        console.log("Already connected to relay");
        return;
    }
    
    console.log(`Connecting to relay: ${RELAY_URL}`);
    
    relaySocket = io(RELAY_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 10000
    });
    
    // Connection event handlers
    relaySocket.on('connect', () => {
        console.log('✅ Connected to relay');
        
        // Send handshake
        const handshake = {
            from: "webapp2-server",
            ts: Date.now()
        };
        
        console.log('📤 Sending handshake:', handshake);
        relaySocket.emit("hello", handshake);
    });
    
    // Listen for welcome response
    relaySocket.on("welcome", (payload) => {
        console.log("🎉 Welcome received:", payload);
    });
    
    // Listen for message broadcasts and handle add/[integer] messages
    relaySocket.on("msg", (message) => {
        console.log("📨 Relay broadcast:", JSON.stringify(message, null, 2));
        
        // Check multiple possible message formats
        let messageText = null;
        
        if (message && message.text) {
            messageText = message.text;
        } else if (message && typeof message === 'string') {
            messageText = message;
        } else if (message && message.message) {
            messageText = message.message;
        } else if (message && message.data) {
            messageText = message.data;
        }
        
        if (messageText) {
            console.log(`🔍 Checking message text: "${messageText}"`);
            
            // Check for add pattern
            const addMatch = messageText.match(/^\/?add\/(\d+)\/session\/(.+)$/);
            if (addMatch) {
                const objectId = addMatch[1];
                const sessionId = addMatch[2];
                
                // Store extracted values in global variables
                lastObjectId = objectId;
                lastSessionId = sessionId;
                
                console.log(`🎯 Detected add/${objectId}/session/${sessionId} command from relay`);
                console.log(`📝 Stored objectId: ${lastObjectId}, sessionId: ${lastSessionId}`);
                
                handleAddObject(objectId, sessionId);
            }
            // Check for check-garden pattern
            else if (messageText.match(/^\/?check-garden\/(\d+)$/)) {
                const checkMatch = messageText.match(/^\/?check-garden\/(\d+)$/);
                const objectId = checkMatch[1];
                
                console.log(`🔍 Detected check-garden/${objectId} command from relay`);
                handleCheckGarden(objectId);
            }
            else {
                console.log(`❌ Message text "${messageText}" does not match any known pattern`);
            }
        } else {
            console.log(`❌ Could not extract text from message:`, message);
        }
    });
    
    // Error handling
    relaySocket.on('connect_error', (error) => {
        console.error('❌ Relay connection error:', error.message);
    });
    
    relaySocket.on('disconnect', (reason) => {
        console.warn('⚠️ Disconnected from relay:', reason);
        if (reason === 'io server disconnect') {
            console.log('🔄 Relay server disconnected client, attempting manual reconnection...');
            relaySocket.connect();
        }
    });
    
    relaySocket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnected to relay after ${attemptNumber} attempts`);
    });
    
    relaySocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Relay reconnection attempt ${attemptNumber}`);
    });
    
    relaySocket.on('reconnect_error', (error) => {
        console.error('❌ Relay reconnection error:', error.message);
    });
    
    relaySocket.on('reconnect_failed', () => {
        console.error('❌ Relay reconnection failed after all attempts');
    });
}

// Function to handle add object command from relay
function handleAddObject(objectId, sessionId = null) {
    console.log(`\n🌐 WebSocket command received - Adding object ${objectId} to SINGLETON garden state`);
    const result = processAddObject(objectId, 'WebSocket Relay', sessionId);
    
    if (result.success && result.gardenState) {
        console.log(`   ✅ State updated - Version: ${result.gardenState.stateVersion}, Total objects: ${result.gardenState.objects.length}/${MAX_GARDEN_OBJECTS}`);
    }
    
    // Optionally send response back to relay
    if (result.success && relaySocket && relaySocket.connected) {
        const response = {
            text: `Response: ${result.message}`,
            timestamp: Date.now(),
            objectId: objectId,
            sessionId: sessionId
        };
        relaySocket.emit("msg", response);
    }
}

// Function to handle check-garden command from relay
function handleCheckGarden(objectId) {
    try {
        console.log(`🔍 Checking if object ${objectId} exists in garden`);
        
        // Use the removeObject function from object manager
        const { removeObject } = require('./object-manage/object-manager');
        const result = removeObject(objectId);
        
        if (result.success) {
            console.log(`✅ ${result.message}`);
        } else {
            console.log(`ℹ️ ${result.message}`);
        }
        
        // Send simple acknowledgment back to relay
        if (relaySocket && relaySocket.connected) {
            const response = {
                text: `ACK: check-garden/${objectId}`,
                timestamp: Date.now(),
                objectId: objectId
            };
            relaySocket.emit("msg", response);
        }
    } catch (error) {
        console.error(`❌ Error checking garden for object ${objectId}:`, error.message);
        
        // Send simple acknowledgment even on error
        if (relaySocket && relaySocket.connected) {
            const response = {
                text: `ACK: check-garden/${objectId}`,
                timestamp: Date.now(),
                objectId: objectId
            };
            relaySocket.emit("msg", response);
        }
    }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET route for current garden state
app.get('/garden-state', (req, res) => {
    try {
        const { getGardenState } = require('./object-manage/object-manager');
        const gardenState = getGardenState();
        res.json({
            success: true,
            gardenState: gardenState
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching garden state: ' + error.message
        });
    }
});

// GET route for last extracted data (objectId and sessionId)
app.get('/last-data', (req, res) => {
    try {
        const data = getLastExtractedData();
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching last data: ' + error.message
        });
    }
});

// POST route for adding objects
app.post('/add/:number', (req, res) => {
    const objectId = req.params.number;
    console.log(`\n🌐 HTTP POST - Adding object ${objectId} to SINGLETON garden state`);
    const result = processAddObject(objectId, 'HTTP POST');
    
    if (result.success && result.gardenState) {
        console.log(`   ✅ State updated - Version: ${result.gardenState.stateVersion}, Total objects: ${result.gardenState.objects.length}/${MAX_GARDEN_OBJECTS}`);
    }
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// POST route to clear the garden
app.post('/clear-garden', (req, res) => {
    try {
        console.log('\n🧹 Clearing garden...');
        const { clearGarden } = require('./object-manage/object-manager');
        const clearedState = clearGarden();
        
        console.log('✅ Garden cleared successfully\n');
        
        res.json({
            success: true,
            message: 'Garden cleared successfully',
            gardenState: clearedState
        });
    } catch (error) {
        const errorMessage = `Error clearing garden: ${error.message}`;
        console.error(`❌ ${errorMessage}`);
        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
});

// POST route for batch adding objects (set entire garden)
app.post('/set-garden', (req, res) => {
    try {
        const { clearFirst, objectIds } = req.body;
        
        // Validate input
        if (!Array.isArray(objectIds)) {
            return res.status(400).json({
                success: false,
                message: 'objectIds must be an array'
            });
        }
        
        if (objectIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'objectIds array cannot be empty'
            });
        }
        
        if (objectIds.length > MAX_GARDEN_OBJECTS) {
            return res.status(400).json({
                success: false,
                message: `objectIds array cannot contain more than ${MAX_GARDEN_OBJECTS} objects (received ${objectIds.length})`
            });
        }
        
        // Remove duplicates from the input array
        const uniqueObjectIds = [...new Set(objectIds.map(id => id.toString()))];
        const duplicatesRemoved = objectIds.length - uniqueObjectIds.length;
        
        if (duplicatesRemoved > 0) {
            console.log(`⚠️ Removed ${duplicatesRemoved} duplicate(s) from input array`);
            console.log(`   Original: [${objectIds.join(', ')}]`);
            console.log(`   Cleaned:  [${uniqueObjectIds.join(', ')}]`);
        }
        
        console.log(`\n🌱 Setting entire garden with ${uniqueObjectIds.length} objects...`);
        console.log(`   Object IDs: [${uniqueObjectIds.join(', ')}]`);
        console.log(`   Clear first: ${clearFirst}`);
        
        if (clearFirst) {
            console.log(`   🔄 REPLACING entire garden state - all previous changes will be removed`);
        } else {
            console.log(`   ➕ ADDING to existing garden state - cumulative with previous changes`);
        }
        
        // Use batch add function (processes all objects and returns OSC array)
        const { addObjectsBatch } = require('./object-manage/object-manager');
        const batchResult = addObjectsBatch(uniqueObjectIds, clearFirst);
        
        // Send single OSC message with array of all objects
        const { sendObjectArrayEvent } = require('./object-manage/osc-sender');
        const oscResult = sendObjectArrayEvent(batchResult.oscArray);
        
        const message = `Garden setup complete: ${batchResult.summary.successful} objects added successfully, ${batchResult.summary.failed} failed`;
        console.log(`\n✅ ${message}`);
        console.log(`   📊 Final State - Version: ${batchResult.gardenState.stateVersion}, Total objects: ${batchResult.gardenState.objects.length}/${MAX_GARDEN_OBJECTS}\n`);
        
        res.json({
            success: true,
            message: message,
            summary: batchResult.summary,
            addedObjects: batchResult.addedObjects,
            removedObjects: batchResult.removedObjects,
            results: batchResult.results,
            gardenState: batchResult.gardenState,
            oscData: {
                sent: oscResult.success,
                address: oscResult.oscAddress,
                count: oscResult.count,
                array: oscResult.array
            }
        });
        
    } catch (error) {
        const errorMessage = `Error setting garden: ${error.message}`;
        console.error(`❌ ${errorMessage}`);
        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
    // Establish WebSocket connection to relay
    connectToRelay();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (relaySocket) {
        relaySocket.disconnect();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    if (relaySocket) {
        relaySocket.disconnect();
    }
    process.exit(0);
});
