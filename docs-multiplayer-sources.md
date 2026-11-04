# Multiplayer code research — November 3, 2026

These are actual source repositories, not embedded games or installed providers.

| Project | Code and license | Fit |
| --- | --- | --- |
| Snake IO Multiplayer | https://github.com/m0Corut/snake-io-multiplayer — MIT, verified in LICENSE | TypeScript, Node and Socket.IO; a possible base for a larger snake arena. Requires a Node/Socket.IO server rather than Vela's Workers runtime. |
| Multiplayer Snake | https://github.com/yunzhu-li/multiplayer-snake — MIT, verified in LICENSE | Complete browser/server network snake implementation. Older Node/Socket.IO architecture; useful reference for additional shared arenas. |
| boardgame.io | https://github.com/boardgameio/boardgame.io — MIT, verified in LICENSE | Framework for many real turn-based games, hidden player state and multiplayer synchronization. Suitable when adding more complex card/board games. |

Vela's installed Slither, Tic Tac Toe, Rock Paper Scissors and Connect Four use a new shared server-authoritative room implementation for its existing Cloudflare platform. No code from the researched repositories was copied or represented as already integrated. Connect Four is the additional playable multiplayer title in this update. Each friend room has its own Durable Object, authenticated connections, ready/rematch flow and reconnect support. RPS choices are redacted separately for each player until both have locked in.


## November 4 upgrade

Integrated: [chess.js 1.4.0](https://github.com/jhlywa/chess.js), BSD-2-Clause, supplies the actual legal-move, castling, en passant, promotion, checkmate and draw rules in both the authoritative multiplayer server and browser bot worker. The full copyright/license ships at `/licenses/chess.js.txt`. The Vela chess UI, computer search, friend invitations and WebSocket transport are our integration code. Reversi is implemented locally with authoritative move validation, automatic passes, final scoring and computer opponents.

Additional complete multiplayer code researched (not installed or represented as shipped):

- [Pong Multiplayer](https://github.com/aslamdoctor/pong-multiplayer): browser Pong, computer opponents and Socket.IO multiplayer. It requires a Node/Socket.IO deployment or a transport port before integration.
- [Slither Clone SIO](https://github.com/mathe00/slither-clone-sio): a full Node/WebGL snake project, advertising MIT licensing, offline mode and customization. It is a future integration candidate, not the code currently running inside Vela.

The shipped six-game collection now uses expiring direct invitations and Accept & play. Internal match identifiers remain necessary for authoritative synchronization; there is no player-facing room browser or room code. Existing legacy matches still work. Offline bot matches run without API creation, and board-game AI runs in a dedicated browser Worker. Slither now has a larger scrolling arena, minimap, eight arena bots, safe starting positions and a 10 Hz network snapshot cadence over a 20 Hz server simulation.
