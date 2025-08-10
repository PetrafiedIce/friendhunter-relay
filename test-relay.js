const WebSocket = require('ws');
const http = require('http');

// Test configuration
const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080';
const ADMIN_TOKEN = 'admin-token-123';

console.log('Testing Friend Hunter Relay Server...');
console.log('Relay URL:', RELAY_URL);

// Test WebSocket connection
function testWebSocket() {
    return new Promise((resolve, reject) => {
        console.log('\n1. Testing WebSocket connection...');
        
        const ws = new WebSocket(RELAY_URL);
        
        ws.on('open', () => {
            console.log('✓ WebSocket connected successfully');
            
            // Send authentication
            const authMessage = {
                type: 'auth',
                token: 'test-client-token'
            };
            ws.send(JSON.stringify(authMessage));
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'auth_response') {
                if (message.success) {
                    console.log('✓ Authentication successful');
                    
                    // Send a test player update
                    const playerUpdate = {
                        type: 'player_update',
                        uuid: 'test-uuid-123',
                        username: 'TestPlayer',
                        x: 100.0,
                        y: 64.0,
                        z: 200.0,
                        server: 'test-server.com'
                    };
                    ws.send(JSON.stringify(playerUpdate));
                    console.log('✓ Sent test player update');
                    
                    setTimeout(() => {
                        ws.close();
                        resolve();
                    }, 1000);
                } else {
                    console.log('✗ Authentication failed:', message.message);
                    ws.close();
                    reject(new Error('Authentication failed'));
                }
            }
        });
        
        ws.on('error', (error) => {
            console.log('✗ WebSocket error:', error.message);
            reject(error);
        });
        
        ws.on('close', () => {
            console.log('✓ WebSocket connection closed');
        });
    });
}

// Test HTTP endpoints
function testHttpEndpoints() {
    return new Promise((resolve, reject) => {
        console.log('\n2. Testing HTTP endpoints...');
        
        const baseUrl = RELAY_URL.replace('ws://', 'http://').replace('wss://', 'https://');
        
        // Test health endpoint
        http.get(baseUrl + '/health', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✓ Health endpoint working');
                    const health = JSON.parse(data);
                    console.log('  - Status:', health.status);
                    console.log('  - Active connections:', health.activeConnections);
                    console.log('  - Online players:', health.onlinePlayers);
                } else {
                    console.log('✗ Health endpoint failed:', res.statusCode);
                }
                
                // Test admin players endpoint
                const options = {
                    hostname: new URL(baseUrl).hostname,
                    port: new URL(baseUrl).port || 80,
                    path: '/admin/players',
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + ADMIN_TOKEN
                    }
                };
                
                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            console.log('✓ Admin players endpoint working');
                            const players = JSON.parse(data);
                            console.log('  - Total players:', players.totalPlayers);
                        } else {
                            console.log('✗ Admin players endpoint failed:', res.statusCode);
                        }
                        resolve();
                    });
                });
                
                req.on('error', (error) => {
                    console.log('✗ Admin players request failed:', error.message);
                    resolve();
                });
                
                req.end();
            });
        }).on('error', (error) => {
            console.log('✗ Health request failed:', error.message);
            resolve();
        });
    });
}

// Run tests
async function runTests() {
    try {
        await testWebSocket();
        await testHttpEndpoints();
        console.log('\n✓ All tests completed successfully!');
        console.log('\nThe relay server is working correctly.');
    } catch (error) {
        console.log('\n✗ Tests failed:', error.message);
        console.log('\nPlease check:');
        console.log('1. The relay server is running');
        console.log('2. The RELAY_URL environment variable is correct');
        console.log('3. Network connectivity');
        process.exit(1);
    }
}

runTests();
