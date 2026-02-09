# Frontend - Stickman Archers

HTML5 Canvas game client with WebSocket multiplayer.

## Structure

```
frontend/
├── index.html              # Menu/lobby screen
├── game.html              # Game screen
├── css/
│   └── styles.css         # All styles
└── js/
    ├── config.js          # Game constants
    ├── api.js             # REST API client
    ├── menu.js            # Menu logic
    ├── websocket.js       # WebSocket manager
    ├── game.js            # Game state manager
    ├── player.js          # Player & Arrow classes
    ├── renderer.js        # Canvas rendering
    ├── input.js           # Keyboard/mouse input
    └── main.js            # Entry point
```

## How to Run

### Option 1: Python HTTP Server
```bash
cd frontend
python -m http.server 8080
```
Open http://localhost:8080

### Option 2: Live Server (VS Code)
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

### Option 3: Any web server
Serve the `frontend` folder on any HTTP server.

## Game Flow

1. **Menu** (`index.html`)
   - Create room or join with code
   - Enter nickname
   - Redirects to `game.html`

2. **Lobby** (`game.html` - overlay)
   - Shows team lists
   - Wait for players
   - Auto-starts when ready

3. **Game** (`game.html` - canvas)
   - Control stickman with WASD
   - Aim with mouse
   - Click and hold to draw bow
   - Release to shoot arrow

## Controls

- **A/D** - Move left/right
- **W/Space** - Jump
- **Mouse** - Aim
- **Click & Hold** - Draw bow
- **Release** - Shoot arrow

## Features

✅ Room creation & joining  
✅ Team auto-assignment (RED/BLUE)  
✅ Real-time player synchronization  
✅ Stickman physics (gravity, jumping)  
✅ Bow & arrow shooting  
✅ Arrow physics with gravity  
✅ Collision detection  
✅ Health system  
✅ Team-based combat  
✅ Responsive canvas rendering  
✅ WebSocket reconnection  

## Config

Edit `js/config.js` to change:
- Game dimensions
- Physics values
- Movement speed
- Arrow speed
- Tick rate
- API/WebSocket URLs

## Unified Stickman Module

The renderer now supports a unified `js/stickman.js` module with a single `window.Stickman` object:
- `draw(ctx, data)`
- `update(player, dt)`
- `animate(player, dt)`
- `drawRagdoll(ctx, partsByType, color)`

`js/stickman_ai.js` adds optional local AI steering for debugging/practice. Enable with `CONFIG.ENABLE_LOCAL_STICKMAN_AI = true`.

## JS Tests

Run lightweight Node-based tests:

```bash
node frontend/js/tests/controller-utils.test.js
node frontend/js/tests/stickman.test.js
```
