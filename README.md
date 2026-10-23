# Vela

Live site: https://cydpixl.github.io/v/

GitHub Pages hosts the frontend. The authenticated API, private media and WebSocket signaling use a separate backend. Firebase retains existing sign-ins. Calls use WebRTC.

## Build

Run `npm ci`, `npm run check`, then `npm run build:github`. Publish the main branch's `/docs` directory. `.env.github` contains only the public API origin. Private credentials, QA accounts and migration exports are excluded from Git.

Apply `worker/schema.sql` and `worker/features.sql` to D1 before deploying the backend. The backend requires Firebase authentication, D1, R2, the existing UserHub/CallRoom Durable Objects, `API_TICKET_SECRET`, and `GIPHY_KEY`. No credentials belong in the frontend bundle.

## Implemented

Direct/group messaging, friends, inline editing, read receipts, photos/files, camera photo capture with retake/direct send, GIF search, transparent custom emoji/stickers, sticker favorites, anchored account/profile cards, profile-photo cropping, bios/pronouns/banner colors, real game search and profile collections. Calls include drag/keyboard stage resizing, camera speaking outlines, camera focus, screen sharing, device selection, ringing indicators, rejoining and transfer between browser sessions.

Movies includes the retained library, catalog search/details, series/episodes, My List, progress, shared uploaded-video playback as an in-call media tile, a glass-style in-call movie browser, late joining, MP4/WebM multipart uploads, and the previous external provider player. The original library storage and playback initialization repair are retained. New uploads share a capped R2 allowance.

The sidebar Library opens uploaded media inside the Vela workspace. Search, Movies/Shows/Continue Watching/Watched filters, and title/release/recent sorting operate on the retained library; progress views keep individual episodes. Saved Messages supports search, opening the original conversation, and removing bookmarks. Uploaded-video controls include ten-second skips, left/right-arrow seeking, Space to play/pause when the video has focus, and a Library picker. Series without catalog metadata browse their uploaded seasons directly. Run `npm run test:library` for library state regressions.

## Verification and limits

The `scripts/qa-*.mjs` browser checks exercise dedicated QA accounts loaded from ignored `.private/qa.json`; they do not contain credentials. Shared playback tests decode the retained video, synchronize play/pause/seek and late joining. Upload checks compare exact stored bytes and verify authenticated/range access. Call tests use real WebRTC with browser capture fixtures.

This remains an independent app with unfinished Discord parity. Server creation/import, Discord identity/game-account linking and statistics, poll/app commands, and the complete Discord moderation/permissions system are not implemented. Mutual-server views reflect stored Vela memberships, not Discord memberships. TURN relay fallback is not configured. Phone handoff is browser-tested; physical iOS/Android behavior still needs device validation. Third-party movie providers depend on their availability and were not verified title-by-title.

Emoji attribution: [Twemoji](https://github.com/jdecked/twemoji), CC-BY 4.0 graphics; emoji-mart metadata, MIT. See `public/emoji/ATTRIBUTION.txt`.

Clipboard screenshots: focus the message box and press Ctrl+V (Cmd+V on macOS). Images use the existing private attachment uploader, show a removable thumbnail, and wait for Send. Text paste is preserved. One attachment per message; 25 MB limit. Run `npm run test:clipboard` for clipboard extraction and paste-event checks.
