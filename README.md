# Friend Hunter Relay Server

A WebSocket relay server for the Friend Hunter Minecraft mod that enables cross-server bounty hunting.

## Features

- **Real-time Communication**: WebSocket-based communication between mod clients
- **Player Tracking**: Track player positions across multiple servers
- **Bounty System**: Coordinate bounty assignments and completions
- **Admin Management**: Admin endpoints for player management and server control
- **Health Monitoring**: Built-in health check endpoint

## Admin Features

### Authentication
The server uses token-based authentication for admin endpoints. Add your admin tokens to the `adminTokens` set in `server.js`:

```javascript
const adminTokens = new Set(['your-admin-token-here', 'another-admin-token']);
```

### Admin Endpoints

#### GET /admin/players
Get all connected players from the relay server.

**Headers:**
```
Authorization: Bearer your-admin-token
```

**Response:**
```json
{
  "players": [
    {
      "uuid": "player-uuid",
      "username": "player-name",
      "x": 100.0,
      "y": 64.0,
      "z": 200.0,
      "server": "server-ip",
      "lastSeen": 1234567890,
      "isBounty": false
    }
  ],
  "totalPlayers": 1,
  "currentBounty": "bounty-uuid"
}
```

#### POST /admin/kick
Kick a player from the relay server.

**Headers:**
```
Authorization: Bearer your-admin-token
Content-Type: application/json
```

**Body:**
```json
{
  "playerUuid": "player-uuid-to-kick"
}
```

#### POST /admin/broadcast
Send a broadcast message to all connected clients.

**Headers:**
```
Authorization: Bearer your-admin-token
Content-Type: application/json
```

**Body:**
```json
{
  "message": "Your broadcast message",
  "type": "admin_broadcast"
}
```

## Deployment

### Railway (Recommended)
1. Fork this repository
2. Connect your Railway account
3. Create a new service from your fork
4. Railway will automatically detect the Node.js app and deploy it
5. The service URL will be your relay server URL

### Heroku
1. Create a new Heroku app
2. Connect your GitHub repository
3. Deploy the `relay-server` directory
4. Set the buildpack to `heroku/nodejs`

### Local Development
1. Install Node.js (v16 or higher)
2. Navigate to the relay-server directory
3. Run `npm install`
4. Run `npm start` or `npm run dev`

## Configuration

The server runs on the port specified by the `PORT` environment variable (default: 8080).

## Health Check

The server provides a health check endpoint at `/health` that returns server statistics:

```json
{
  "status": "healthy",
  "uptime": 123456,
  "activeConnections": 5,
  "totalConnections": 25,
  "messagesProcessed": 1000,
  "onlinePlayers": 5,
  "currentBounty": "bounty-uuid"
}
```

## Security Notes

- Change the default admin tokens before deployment
- Consider implementing rate limiting for production use
- Use HTTPS in production environments
- Monitor server logs for suspicious activity

## Support

For issues and questions, please refer to the main Friend Hunter mod repository.
