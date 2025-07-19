# Friend Hunter Relay Server

WebSocket relay server for the Friend Hunter Minecraft mod. Enables cross-server bounty hunting by relaying player positions, bounty updates, and game events between mod clients.

## Features

- Player position synchronization across servers
- Real-time bounty selection and updates
- Kill event broadcasting
- Shop purchase notifications
- Global event coordination (Double Rewards, Force Night, etc.)
- Auto-reconnection handling

## Deployment

This server is designed to be deployed on Railway, Heroku, or any Node.js hosting platform.

### Environment Variables

- `PORT` - Automatically set by Railway (defaults to 8080 locally)

## API

The server communicates via WebSocket with the following message types:

- `auth` - Client authentication
- `player_update` - Position updates
- `bounty_update` - Bounty selection
- `kill_event` - Player kill notifications
- `global_event` - Shop-triggered global events
- `shop_purchase` - Purchase broadcasts
- `currency_sync` - Dabloons synchronization
- `heartbeat` - Keep-alive messages

## Security

- Token-based authentication
- Client session management
- Auto-cleanup of inactive players
