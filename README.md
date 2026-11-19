# Chase

A multiplayer 3D chase game. `Brkanica` is the original Java/JOGL game client (it can also host a server from its launcher) and `Server` is the standalone Java/KryoNet server. Both listen on or connect to TCP/UDP port 27960.

A separate **WebGL 2.0 browser edition** is available in [`webgl/`](webgl/README.md). It keeps the original desktop client and server intact and currently provides a local match against AI opponents. Browser multiplayer requires a WebSocket-compatible server gateway because browsers cannot connect directly to the original TCP/UDP transport.

## Build and run the original desktop game

Requires a JDK (8 or newer). The dependencies are the jars committed under `Brkanica/jar` and `Server/jar`.

```bash
./gradlew build
./gradlew :Server:run
./gradlew :Brkanica:run
```

## Run the WebGL edition

```bash
cd webgl
python -m http.server 8080
```

webGL example: https://chasethegame-webgl.vercel.app/

Then open http://localhost:8080 in a WebGL 2-compatible browser.
