# VELA 1.5.6 verification

The reported `I appreciate you idiot retard` case now becomes `I appreciate you, wonderful friend`. Standalone insults, insult chains, direct-address insults and separated spellings are covered by the shared rewrite. Negations, links, code, emoji tokens and live-music message markers are preserved. These remain explicit English rules rather than unrestricted semantic moderation.

Live music now has a compact player above the scrollable chat. Active sent cards appear there while listening; pinned cards remain there across scrolling, reloads, older history pages and the end of playback. Full cards remain saved as ordinary chat messages. The player provides functional Pin/Unpin and Jump actions, renders properly in Pinned Messages, and keeps pause/progress/track information synchronized. It does not pretend to play audio inside VELA: audio continues in the Windows media player.

Sent-card recovery reads authenticated message records from the server. The old three-card cap and one-day local expiry were removed. Repeated Send updates the existing message in that conversation. Recovery includes older pinned cards and refreshes periodically to pick up pins made by another participant. SMTC continues syncing shared chat cards when the tab is in the background and sends pause state even when paused tracks are hidden in the sidebar. A closed or browser-suspended page cannot publish new native-player information; the saved message and pins remain intact.

Checks completed on 2026-10-31:

- 28 rewrite cases with idempotence, Unicode, negation and protected-content checks.
- Raw authenticated API create/edit/retry/schedule checks using the exact reported insult chain.
- SQLite execution of the music read queries: history beyond 50 messages, old pins, latest per sender, no expiry, deleted records and membership/account isolation.
- Two-account browser tests of pin/unpin, scrolling, reload, a history page excluding the original card, local-record loss, track changes without duplicate messages, paused playback, rich pinned cards, and pins remaining after playback ends.
- Decoded remote WebRTC video alongside the persistent player at 320×640, 390×844, 844×390 and 390×490. Both player and composer remained reachable, with no horizontal overflow or app page errors.
- Existing mobile-call regression suite at seven viewport sizes, including mobile fullscreen and the no-fullscreen fallback.
- Bridge fixture tests include paused/background chat syncing, automatic detection, reconnect and opt-out.
- Full syntax checks, production/GitHub Pages builds and Worker deployment dry run.

Run `npm run test:kind-messages`, `npm run test:kind-api`, `npm run test:live-music-api`, `npm run qa:live-player`, `npm run qa:kind-calls` and `npm run qa:smtc`. Browser QA defaults to the local production build served under the production origin; set `QA_SITE=https://cydpixl.github.io/v/` for live verification. Existing ignored `.private/qa.json` supplies the QA accounts. Physical iPhone/Android installed-PWA behavior was not tested.
