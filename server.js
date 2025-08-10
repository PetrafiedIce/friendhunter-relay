// Enhanced WebSocket relay server for Friend Hunter mod
// Deploy this to Heroku, Railway, or any Node.js hosting service

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const connectedClients = new Map();
const adminTokens = new Set(['admin-token-123', 'super-admin-456']); // Add your admin tokens here
const gameState = {
    currentBounty: null,
    onlinePlayers: new Map(),
    activeEvents: new Map(),
    serverStats: {
        totalConnections: 0,
        activeConnections: 0,
        messagesProcessed: 0,
        startTime: Date.now()
    }
};

// Add health check and admin endpoints
server.on('request', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: Date.now() - gameState.serverStats.startTime,
            activeConnections: gameState.serverStats.activeConnections,
            totalConnections: gameState.serverStats.totalConnections,
            messagesProcessed: gameState.serverStats.messagesProcessed,
            onlinePlayers: gameState.onlinePlayers.size,
            currentBounty: gameState.currentBounty
        }));
    } else if (req.url === '/admin/players') {
        // Admin endpoint to get all connected players
        const authHeader = req.headers.authorization;
        if (!authHeader || !adminTokens.has(authHeader.replace('Bearer ', ''))) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        const players = Array.from(gameState.onlinePlayers.values()).map(player => ({
            uuid: player.uuid,
            username: player.username,
            x: player.x,
            y: player.y,
            z: player.z,
            server: player.server,
            lastSeen: player.lastSeen,
            isBounty: gameState.currentBounty === player.uuid
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            players: players,
            totalPlayers: players.length,
            currentBounty: gameState.currentBounty
        }));
    } else if (req.url === '/admin/kick' && req.method === 'POST') {
        // Admin endpoint to kick a player
        const authHeader = req.headers.authorization;
        if (!authHeader || !adminTokens.has(authHeader.replace('Bearer ', ''))) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { playerUuid } = JSON.parse(body);
                const client = connectedClients.get(playerUuid);
                if (client) {
                    client.ws.close(1000, 'Kicked by admin');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Player kicked' }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Player not found' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (req.url === '/admin/broadcast' && req.method === 'POST') {
        // Admin endpoint to broadcast a message
        const authHeader = req.headers.authorization;
        if (!authHeader || !adminTokens.has(authHeader.replace('Bearer ', ''))) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { message, type = 'admin_message' } = JSON.parse(body);
                broadcastToAll({
                    type: type,
                    message: message,
                    timestamp: Date.now()
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Broadcast sent' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

wss.on('connection', function connection(ws) {
    console.log('New client connected');
    gameState.serverStats.totalConnections++;
    gameState.serverStats.activeConnections++;

    ws.on('message', function incoming(data) {
        try {
            const message = JSON.parse(data);
            gameState.serverStats.messagesProcessed++;
            handleMessage(ws, message);
        } catch (err) {
            console.error('Invalid message:', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', function close() {
        gameState.serverStats.activeConnections--;
        
        // Remove client from connected clients
        for (const [clientId, client] of connectedClients) {
            if (client.ws === ws) {
                connectedClients.delete(clientId);
                gameState.onlinePlayers.delete(clientId);
                broadcastToAll({
                    type: 'player_disconnected',
                    player_uuid: clientId
                });
                console.log(`Client ${clientId} disconnected`);
                break;
            }
        }
    });

    ws.on('error', function error(err) {
        console.error('WebSocket error:', err);
        gameState.serverStats.activeConnections--;
    });
});

function handleMessage(ws, message) {
    switch (message.type) {
        case 'auth':
            handleAuth(ws, message);
            break;
        case 'player_update':
            handlePlayerUpdate(ws, message);
            break;
        case 'bounty_update':
            handleBountyUpdate(message);
            break;
        case 'kill_event':
            handleKillEvent(message);
            break;
        case 'global_event':
            handleGlobalEvent(message);
            break;
        case 'shop_purchase':
            handleShopPurchase(message);
            break;
        case 'currency_sync':
            handleCurrencySync(message);
            break;
        case 'heartbeat':
            // Keep connection alive
            break;
    }
}

function handleAuth(ws, message) {
    // Simple token validation (implement proper auth as needed)
    const token = message.token;
    if (!token || token.length < 8) {
        ws.send(JSON.stringify({
            type: 'auth_response',
            success: false,
            message: 'Invalid auth token'
        }));
        ws.close(1008, 'Invalid auth token');
        return;
    }

    // Store authenticated client
    const clientId = generateClientId();
    connectedClients.set(clientId, { ws, token, lastSeen: Date.now() });

    ws.send(JSON.stringify({
        type: 'auth_response',
        success: true,
        client_id: clientId
    }));
    
    console.log(`Client ${clientId} authenticated successfully`);
}

function handlePlayerUpdate(ws, message) {
    const clientId = getClientId(ws);
    if (!clientId) return;

    gameState.onlinePlayers.set(message.uuid, {
        uuid: message.uuid,
        username: message.username,
        x: message.x,
        y: message.y,
        z: message.z,
        server: message.server,
        lastSeen: Date.now()
    });

    // Broadcast to other clients
    broadcastToOthers(ws, message);
}

function handleBountyUpdate(message) {
    gameState.currentBounty = message.bounty_uuid;
    broadcastToAll(message);
}

function handleKillEvent(message) {
    broadcastToAll(message);
}

function handleGlobalEvent(message) {
    const eventId = generateEventId();
    gameState.activeEvents.set(eventId, {
        type: message.event_type,
        duration: message.duration,
        startTime: Date.now()
    });

    broadcastToAll(message);

    // Auto-remove event after duration
    setTimeout(() => {
        gameState.activeEvents.delete(eventId);
    }, message.duration * 60 * 1000);
}

function handleShopPurchase(message) {
    broadcastToAll(message);
}

function handleCurrencySync(message) {
    broadcastToAll(message);
}

function broadcastToAll(message) {
    connectedClients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function broadcastToOthers(senderWs, message) {
    connectedClients.forEach(client => {
        if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function getClientId(ws) {
    for (const [clientId, client] of connectedClients) {
        if (client.ws === ws) {
            return clientId;
        }
    }
    return null;
}

function generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
}

function generateEventId() {
    return 'event_' + Math.random().toString(36).substr(2, 9);
}

// Cleanup offline players every 5 minutes
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;

    for (const [uuid, player] of gameState.onlinePlayers) {
        if (now - player.lastSeen > timeout) {
            gameState.onlinePlayers.delete(uuid);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} offline players`);
    }
}, 5 * 60 * 1000);

// Log server stats every 10 minutes
setInterval(() => {
    console.log(`Server Stats - Active: ${gameState.serverStats.activeConnections}, ` +
                `Total: ${gameState.serverStats.totalConnections}, ` +
                `Messages: ${gameState.serverStats.messagesProcessed}, ` +
                `Players: ${gameState.onlinePlayers.size}`);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Friend Hunter relay server listening on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
