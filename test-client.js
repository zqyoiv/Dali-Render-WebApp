// Quick test script to verify WebSocket client functionality
const { io } = require('socket.io-client');

console.log('Testing WebSocket client connection...');

const socket = io("wss://two025-dali-garden-webapp.onrender.com", {
    transports: ["websocket"],
    reconnection: false, // Disable reconnection for testing
    timeout: 5000
});

let testPassed = false;

socket.on('connect', () => {
    console.log('✅ Connection successful');
    
    // Send handshake
    const handshake = { from: "webapp2", ts: Date.now() };
    console.log('📤 Sending handshake:', handshake);
    socket.emit("hello", handshake);
    
    // Send test message
    setTimeout(() => {
        const testMessage = { text: "ping-from-webapp2" };
        console.log('📤 Sending test message:', testMessage);
        socket.emit("msg", testMessage);
    }, 1000);
});

socket.on('welcome', (payload) => {
    console.log('🎉 Welcome received:', payload);
    testPassed = true;
});

socket.on('msg', (message) => {
    console.log('📨 Message received:', message);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
});

socket.on('disconnect', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    if (testPassed) {
        console.log('✅ Test completed successfully');
        process.exit(0);
    } else {
        console.log('⚠️ Test completed but no welcome message received');
        process.exit(0);
    }
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('⏰ Test timeout');
    socket.disconnect();
    process.exit(0);
}, 10000);

