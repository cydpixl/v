# VELA 1.7.0 · Chat and Music

Implemented locally on branch `improve/vela-features-20261031` on November 1, 2026. This change is not deployed. The separate Vela-Shop-integration checkout has uncommitted work and was left untouched.

## Product behavior

- Chat has calmer spacing, a simpler header and four visible composer controls: attachments, Music, emoji and Send. GIFs, stickers, camera, voice, scheduling, uploads, commands and drawing tools remain in the + menu. Existing calls, themes, text-size preferences and reduced-motion settings remain available.
- The local SMTC player is a slim bar above the composer. It is absent from the sidebar and hidden when no active track is available. Its Send button finds the matching Apple song and sends a playable artwork card. A version-selection sheet opens when an exact match is unavailable; it never silently sends a different song. Live activity sharing remains a separate action.
- Music is in the main navigation, with Browse, This week and Friends views. Browse has real Apple catalog results, genre/artist discovery, audio playback and direct Send buttons. A visible destination selector determines the recipient. No copy/paste/link workflow or “preview” wording appears in the Music UI.
- Sent songs contain album art, title, artist, album, custom play/pause, audio-position control and an Apple Music source link. Audio streams directly from Apple's catalog; no audio is AI generated or stored by VELA. Playback persists through incoming messages/reactions and stops when its card is removed. Sharing a song preserves the current draft and attachment.
- Weekly history records titles VELA actually observes playing for at least ten seconds, from SMTC and VELA song cards. Repeated heartbeats update the same play at most once a minute. Paused playback and account changes reset observation state. History starts from detected plays after installation; it cannot reconstruct earlier listening or observe playback while VELA and its detector are closed.
- History is stored by account in D1. Your week shows the last seven days; Friends shows accepted friends who opted in, with blocked accounts excluded. Sharing is off by default, can be revoked immediately and is not re-enabled by stale playback heartbeats. A failed preference save restores the prior local state. Users can clear their own history and send songs directly from either history view.

## Verification

- `npm run test:music-sharing` — passed serialization, Unicode, untrusted URL rejection, escaped markup, exact-song matching, real SQLite queries, idempotent history writes, seven-day bounds, cursor pagination, friend consent, blocks, strangers, revocation, account-scoped deletion, observation thresholds, throttling, account isolation and preference-failure recovery.
- `node scripts/qa-smtc.mjs` — passed detector auto-connect, old-setting migration, active-player selection, disconnected recovery, paused/background sync, private default and opt-out persistence, using a controlled bridge fixture.
- `npm run test:outbox` and `node scripts/test-message-admin.mjs` — passed existing queue and custom-message-control regressions.
- `npm run check`, `npm run build` and the GitHub-base production build — passed. Vite reports its retained classic SMTC-script warning and a roughly 503 kB main chunk warning.
- `npm run qa:music-ui` — passed desktop Chromium at 390/768/1440 widths and the light theme. Used the built frontend at the real production origin through a test-only static route, two real Firebase QA accounts, authenticated production messages/WebSocket delivery, and real Apple search/art/audio. Verified send, recipient decode/playback/pause/seeking, retained audio during incoming messages, composer-draft preservation, unobstructed mobile layouts and zero uncaught browser errors.
- Weekly views were exercised against the actual new Worker running locally with isolated D1 records and local-only test authentication. The history endpoint has not been deployed or verified against production D1.
- QA-created production messages were deleted. Test fixtures and credentials are not part of the product. Physical phones, native Apple Music account-history import and WebKit playback were not tested.

## Running and publishing

The working Vite preview is `http://127.0.0.1:5197/`. The isolated history Worker is `http://127.0.0.1:8796/`; browser QA maps only history calls to that local Worker. Product history calls use the configured authenticated API origin.

The new Worker route is `/api/listening-history` (GET, POST, DELETE). Its additive tables/index are in `worker/migrations/0008_listening_history.sql`, and the route safely initializes them on first use. Publish the updated Worker together with the frontend. Reconcile the independent shop work before updating the shared production app.

Apple integration uses the [official Search API](https://performance-partners.apple.com/search-api), with bounded, cached searches and direct playback from returned audio URLs. Prepared D1 statements follow [Cloudflare's API](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).
