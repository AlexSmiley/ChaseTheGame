# Chase — WebGL 2.0 Edition

A browser-based 3D adaptation of **ChaseTheGame**. The original Java/JOGL desktop client and Java/KryoNet server remain unchanged.

## Run locally

WebGL modules must be served over HTTP (not opened as a `file://` URL).

```bash
cd webgl
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Controls

- **W / A / S / D** — move
- **Mouse** — look around (click the game to recapture the pointer)
- **Shift** — sprint
- **Esc** — pause / release pointer lock

## Current browser build

- WebGL 2.0 renderer with custom GLSL shaders, perspective camera, depth testing, lighting and fog
- Procedurally generated arena, walls, obstacles and pickups
- First-person movement, collision checks, AI opponents, chase/runner roles, tagging, scoring and a timed match

## Multiplayer compatibility

The desktop project uses KryoNet over TCP/UDP on port **27960**. Browsers cannot connect to arbitrary TCP/UDP sockets, so the existing server cannot be used directly from this WebGL client. The current browser edition is a local match against AI opponents. A true online browser mode needs a WebSocket gateway (or a server transport migration) and a shared, authoritative game-state protocol. The original server and native client are preserved for that follow-up integration.
