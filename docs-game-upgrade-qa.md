# Direct invites and game upgrade verification

November 4, 2026.

- Six multiplayer apps: Slither, Tic Tac Toe, Rock Paper Scissors, Connect Four, Chess and Reversi.
- Replaced room browser/code/ready setup with friend selection, expiring invitation cards, accept/decline, automatic launch/start and resumable matches.
- Bot play works without creating an API match; computer search runs in a browser Worker. Easy/normal/hard for strategy games and Slither; RPS uses fair random hidden choices. Same-device play remains available for all four board games.
- Full chess legality supplied by BSD-2-Clause chess.js 1.4.0. License is included in public/licenses/chess.js.txt and the published site.
- Reversi validates flips, passes automatically and scores the final board; harder bots search multiple turns with corner/mobility evaluation.
- Slither: 3200×2200 arena, player camera, minimap, glowing food, eight arena bots, safe spawns and bot respawns; authoritative 20 Hz physics with 10 Hz network snapshots.

## Passed checks

`npm run check`, `npm run test:arcade`, `node scripts/test-vela-games.mjs`, production and GitHub Pages builds.

Real Chrome bot QA: complete Tic Tac Toe, Connect Four, Reversi and RPS matches/rematches; chess legal highlights, actual worker moves, pause/resume and fullscreen; real Slither movement, bots and pause; narrow menus and same-device chess. Screenshots inspected.

Two real accounts against the deployed backend and deployed frontend: direct invitations and automatic starts for all six games, full Tic Tac Toe/Connect Four/RPS/Reversi results and Chess checkmate, hidden RPS choices, rematch, reconnect, authoritative Slither movement, native game fullscreen, accepting an invitation inside another fullscreen game, automatic installation of missing games, and declining/cleaning invitations. No browser JavaScript errors. Test matches were deleted.

SQLite API tests cover friend and block permissions, signed tickets, deduplication, guest-only acceptance, invitation expiry, cleanup and simultaneous crossed invitations. Model tests cover invalid/stale moves, bot tactics, full bot games, chess castling/en passant/underpromotion/checkmate, Slither food/boost/collision and safe spawns. The unchanged bundled web-game skill client captured actual gameplay and text state.

Additional source candidates are documented separately in docs-multiplayer-sources.md; researched Node/Socket.IO games are not claimed as integrated.
