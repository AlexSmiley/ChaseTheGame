# chase
A multiplayer 3D chase game. `Brkanica` is the game client (it can also host a server from its launcher) and `Server` is the standalone server. Both listen on or connect to TCP/UDP port 27960.

## Build and run

Requires a JDK (8 or newer). The dependencies are the jars committed under `Brkanica/jar` and `Server/jar`.

```
./gradlew build          # compile both projects and run the server tests
./gradlew :Server:run    # start the standalone server
./gradlew :Brkanica:run  # start the game launcher
```
