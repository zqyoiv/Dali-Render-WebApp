/**
 * Test Script for Set Entire Garden Feature (OSC Array Format)
 * 
 * This script demonstrates how to programmatically:
 * 1. Clear the garden
 * 2. Set up the entire garden with multiple objects
 * 3. Check the garden state
 * 
 * Note: This uses the OSC ARRAY format - a single OSC message containing
 * all objects is sent to /garden/objects (not individual messages).
 * This is optimized for Unreal Engine batch processing.
 * 
 * Usage: node test-set-garden.js [testCase]
 * Example: node test-set-garden.js medium
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 4000;

// Test case arrays
const TEST_CASES = {
    small: [1, 3, 6, 8, 10],
    medium: [1, 2, 3, 5, 7, 10, 13, 15, 18, 20, 22, 25],
    large: [1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 30],
    full: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    diverse: [1, 3, 6, 7, 10, 11, 14, 17, 19, 21, 23, 24, 26, 28, 30]
};

/**
 * Make a POST request
 */
function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Make a GET request
 */
function makeGetRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Clear the garden
 */
async function clearGarden() {
    console.log('\n🧹 Clearing garden...');
    try {
        const response = await makeRequest('/clear-garden', {});
        if (response.success) {
            console.log('✅ Garden cleared successfully');
            console.log('   Objects in garden:', response.gardenState.objects.length);
        } else {
            console.log('❌ Failed to clear garden:', response.message);
        }
        return response;
    } catch (error) {
        console.error('❌ Error clearing garden:', error.message);
        throw error;
    }
}

/**
 * Set entire garden with objects
 */
async function setGarden(testCaseName, clearFirst = true) {
    const objectIds = TEST_CASES[testCaseName];
    
    if (!objectIds) {
        throw new Error(`Unknown test case: ${testCaseName}`);
    }
    
    console.log(`\n🌱 Setting garden with "${testCaseName}" test case`);
    console.log(`   Objects to add: [${objectIds.join(', ')}]`);
    console.log(`   Clear first: ${clearFirst}`);
    
    try {
        const response = await makeRequest('/set-garden', {
            clearFirst: clearFirst,
            objectIds: objectIds
        });
        
        if (response.success) {
            console.log(`✅ ${response.message}`);
            console.log('\n📊 Summary:');
            console.log(`   Total: ${response.summary.total}`);
            console.log(`   Successful: ${response.summary.successful}`);
            console.log(`   Failed: ${response.summary.failed}`);
            
            // Display OSC Array Info
            if (response.oscData && response.oscData.sent) {
                console.log('\n📤 OSC Array Sent:');
                console.log(`   Address: ${response.oscData.address}`);
                console.log(`   Count: ${response.oscData.count} objects`);
                console.log(`   Array: ${JSON.stringify(response.oscData.array, null, 2)}`);
            }
            
            console.log('\n🌿 Garden State:');
            console.log(`   Objects: [${response.gardenState.objects.join(', ')}]`);
            console.log(`   Count: ${response.gardenState.objects.length}/22`);
            
            if (response.addedObjects && response.addedObjects.length > 0) {
                console.log('\n➕ Added Objects:');
                response.addedObjects.forEach(obj => {
                    console.log(`   ${obj.id} (${obj.name}) → ${obj.location}`);
                });
            }
            
            if (response.removedObjects && response.removedObjects.length > 0) {
                console.log('\n➖ Removed Objects:');
                response.removedObjects.forEach(obj => {
                    console.log(`   ${obj.id} (${obj.name}) from ${obj.location} (${obj.reason})`);
                });
            }
        } else {
            console.log('❌ Failed to set garden:', response.message);
        }
        return response;
    } catch (error) {
        console.error('❌ Error setting garden:', error.message);
        throw error;
    }
}

/**
 * Get current garden state
 */
async function getGardenState() {
    console.log('\n📊 Fetching garden state...');
    try {
        const response = await makeGetRequest('/garden-state');
        if (response.success) {
            console.log('✅ Garden state retrieved');
            console.log(`   Objects: [${response.gardenState.objects.join(', ')}]`);
            console.log(`   Count: ${response.gardenState.objects.length}/22`);
            console.log(`   Locations: [${response.gardenState.locations.join(', ')}]`);
        } else {
            console.log('❌ Failed to get garden state:', response.message);
        }
        return response;
    } catch (error) {
        console.error('❌ Error getting garden state:', error.message);
        throw error;
    }
}

/**
 * Run test sequence
 */
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Test Script: Set Entire Garden via OSC               ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    try {
        // Get command line argument for test case
        const testCase = process.argv[2] || 'small';
        
        if (!TEST_CASES[testCase]) {
            console.log('\n❌ Invalid test case specified');
            console.log('\nAvailable test cases:');
            Object.keys(TEST_CASES).forEach(key => {
                console.log(`   - ${key} (${TEST_CASES[key].length} objects)`);
            });
            console.log('\nUsage: node test-set-garden.js [testCase]');
            console.log('Example: node test-set-garden.js medium');
            return;
        }
        
        // Step 1: Clear garden
        await clearGarden();
        await sleep(1000);
        
        // Step 2: Set garden with test case
        await setGarden(testCase, false); // false because we just cleared
        await sleep(1000);
        
        // Step 3: Verify final state
        await getGardenState();
        
        console.log('\n✅ All tests completed successfully!\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.log('\nMake sure the server is running on http://localhost:4000\n');
        process.exit(1);
    }
}

/**
 * Helper function to pause execution
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runTests();

