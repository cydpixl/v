# Multiplayer code research — November 3, 2026

These are actual source repositories, not embedded games or installed providers.

| Project | Code and license | Fit |
| --- | --- | --- |
| Snake IO Multiplayer | https://github.com/m0Corut/snake-io-multiplayer — MIT, verified in LICENSE | TypeScript, Node and Socket.IO; a possible base for a larger snake arena. Requires a Node/Socket.IO server rather than Vela's Workers runtime. |
| Multiplayer Snake | https://github.com/yunzhu-li/multiplayer-snake — MIT, verified in LICENSE | Complete browser/server network snake implementation. Older Node/Socket.IO architecture; useful reference for additional shared arenas. |
| boardgame.io | https://github.com/boardgameio/boardgame.io — MIT, verified in LICENSE | Framework for many real turn-based games, hidden player state and multiplayer synchronization. Suitable when adding more complex card/board games. |

Vela's installed Slither, Tic Tac Toe, Rock Paper Scissors and Connect Four use a new shared server-authoritative room implementation for its existing Cloudflare platform. No code from the researched repositories was copied or represented as already integrated. Connect Four is the additional playable multiplayer title in this update. Each friend room has its own Durable Object, authenticated connections, ready/rematch flow and reconnect support. RPS choices are redacted separately for each player until both have locked in.
