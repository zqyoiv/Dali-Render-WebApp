const { io } = require('socket.io-client');

// Configuration
const RELAY_URL = "wss://two025-dali-garden-webapp.onrender.com";

// Validate URL
if (!RELAY_URL) {
    console.error("Error: RELAY_URL is missing. Please provide a valid WebSocket URL.");
    process.exit(1);
}

console.log(`Connecting to relay: ${RELAY_URL}`);

// Create socket connection with hardened reconnection settings
const socket = io(RELAY_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000
});

// Connection event handlers
socket.on('connect', () => {
    console.log('✅ Connected to relay');
    
    // Send handshake immediately after connection
    const handshake = {
        from: "webapp2",
        ts: Date.now()
    };
    
    console.log('📤 Sending handshake:', handshake);
    socket.emit("hello", handshake);
    
    // Send a test message after a short delay
    setTimeout(() => {
        const testMessage = {
            text: "ping-from-webapp2"
        };
        console.log('📤 Sending test message:', testMessage);
        socket.emit("msg", testMessage);
    }, 1000);
});

// Listen for welcome response
socket.on("welcome", (payload) => {
    console.log("🎉 Welcome received:", payload);
});

// Listen for message broadcasts
socket.on("msg", (message) => {
    console.log("📨 Relay broadcast:", message);
});

// Error handling
socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
    console.warn('⚠️ Disconnected:', reason);
    if (reason === 'io server disconnect') {
        // Server disconnected the client, manual reconnection needed
        console.log('🔄 Server disconnected client, attempting manual reconnection...');
        socket.connect();
    }
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Reconnection attempt ${attemptNumber}`);
});

socket.on('reconnect_error', (error) => {
    console.error('❌ Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
    console.error('❌ Reconnection failed after all attempts');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down client...');
    socket.disconnect();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down client...');
    socket.disconnect();
    process.exit(0);
});

// Keep the process alive
console.log('🚀 WebSocket client started. Press Ctrl+C to exit.');

