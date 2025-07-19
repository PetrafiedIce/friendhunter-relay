// Simple WebSocket relay server for Friend Hunter mod
// Deploy this to Heroku, Railway, or any Node.js hosting service

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const connectedClients = new Map();
const gameState = {
    currentBounty: null,
    onlinePlayers: new Map(),
    activeEvents: new Map()
};

wss.on('connection', function connection(ws) {
    console.log('New client connected');

    ws.on('message', function incoming(data) {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (err) {
            console.error('Invalid message:', err);
        }
    });

    ws.on('close', function close() {
        // Remove client from connected clients
        for (const [clientId, client] of connectedClients) {
            if (client.ws === ws) {
                connectedClients.delete(clientId);
                gameState.onlinePlayers.delete(clientId);
                broadcastToAll({
                    type: 'player_disconnected',
                    player_uuid: clientId
                });
                break;
            }
        }
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
        ws.close(1008, 'Invalid auth token');
        return;
    }

    // Store authenticated client
    const clientId = generateClientId();
    connectedClients.set(clientId, { ws, token, lastSeen: Date.now() });

    ws.send(JSON.stringify({
        type: 'auth_success',
        client_id: clientId
    }));
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

    for (const [uuid, player] of gameState.onlinePlayers) {
        if (now - player.lastSeen > timeout) {
            gameState.onlinePlayers.delete(uuid);
        }
    }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Friend Hunter relay server listening on port ${PORT}`);
});
