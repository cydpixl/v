# Vela

Live site: https://cydpixl.github.io/v/

GitHub Pages hosts the frontend. The authenticated API, private media and WebSocket signaling use a separate backend. Firebase retains existing sign-ins. Calls use WebRTC.

## Build

Run `npm ci`, `npm run check`, then `npm run build:github`. Publish the main branch's `/docs` directory. `.env.github` contains only the public API origin. Private credentials, QA accounts and migration exports are excluded from Git.

Apply `worker/schema.sql` and `worker/features.sql` to D1 before deploying the backend. The backend requires Firebase authentication, D1, R2, the existing UserHub/CallRoom Durable Objects, `API_TICKET_SECRET`, and `GIPHY_KEY`. No credentials belong in the frontend bundle.

## Implemented

Direct/group messaging, friends, inline editing, read receipts, photos/files, camera photo/video capture with retake/direct send, GIF search, transparent custom emoji/stickers, sticker favorites, anchored account/profile cards, profile-photo cropping, bios/pronouns/banner colors, real game search and profile collections. Calls include drag/keyboard stage resizing, camera speaking outlines, camera focus, screen sharing, device selection, ringing indicators, rejoining and transfer between browser sessions.

The chat attachment menu includes Connections' creative tools: Draw Something, Coloring Book, Sketchbook, and Draw on a Photo. The studio preserves brushes, eraser, fill with outline gap protection, color picking, four palettes/custom colors and text placement, undo/redo, canvas sizing/zoom, PNG export, nine coloring pages, and account-filtered IndexedDB drafts. Drawings send through Vela's existing private uploader and persistent message outbox without consuming the current composer draft or attachment. Image-message menus include Draw on Image, which sends an independent version as a reply. Sketchbook pages are saved on the current device and origin; they are not cloud-synced. Run `npm run test:creative` for the fill-engine regression checks.

Movies includes the retained library, catalog search/details, series/episodes, My List, progress, shared uploaded-video playback as an in-call media tile, a glass-style in-call movie browser, late joining, MP4/WebM multipart uploads, and the previous external provider player. The original library storage and playback initialization repair are retained. New uploads share a capped R2 allowance.

The sidebar Library opens uploaded media inside the Vela workspace. Search, Movies/Shows/Continue Watching/Watched filters, and title/release/recent sorting operate on the retained library; progress views keep individual episodes. Saved Messages supports search, opening the original conversation, and removing bookmarks. Uploaded-video controls include ten-second skips, left/right-arrow seeking, Space to play/pause when the video has focus, and a Library picker. Series without catalog metadata browse their uploaded seasons directly. Run `npm run test:library` for library state regressions.

## Verification and limits

The `scripts/qa-*.mjs` browser checks exercise dedicated QA accounts loaded from ignored `.private/qa.json`; they do not contain credentials. Shared playback tests decode the retained video, synchronize play/pause/seek and late joining. Upload checks compare exact stored bytes and verify authenticated/range access. Call tests use real WebRTC with browser capture fixtures.

This remains an independent app with unfinished Discord parity. Server creation/import, Discord identity/game-account linking and statistics, poll/app commands, and the complete Discord moderation/permissions system are not implemented. Mutual-server views reflect stored Vela memberships, not Discord memberships. TURN relay fallback is not configured. Phone handoff is browser-tested; physical iOS/Android behavior still needs device validation. Third-party movie providers depend on their availability and were not verified title-by-title.

Emoji attribution: [Twemoji](https://github.com/jdecked/twemoji), CC-BY 4.0 graphics; emoji-mart metadata, MIT. See `public/emoji/ATTRIBUTION.txt`.

Clipboard screenshots: focus the message box and press Ctrl+V (Cmd+V on macOS). Images use the existing private attachment uploader, show a removable thumbnail, and wait for Send. Text paste is preserved. Up to ten attachments per message; 512 MB per file. Run `npm run test:clipboard` for clipboard extraction and paste-event checks.


## Connections tools · 1.4.1

Vela now includes the Connections chat gallery, voice notes, global search, saved-message actions, conversation pin/mute, private message hiding, read-receipt controls, browser notifications, richer markdown, message links, keyboard/context actions, and sidebar resizing.

Groups support 20 members and owner/admin member management. Calls include camera snapshots and 10–60 second replay clips. Profiles include drawings, playable mini-games, favorite films, custom status, and Lanyard activity previews. Uploads support ten attachments, 512 MB files, a persistent resumable queue, and multipart checkpoints. Media tools include music/shared listening, MKV/MOV conversion, subtitle tracks/editing/preferences, explicit watched flags and watch-time tracking, and diagnostics.

Servers and channels are excluded. Browser notifications require permission; Discord activity requires an account monitored by Lanyard. See [QA-CONNECTIONS.md](QA-CONNECTIONS.md) for verification and the additive database migration required before deployment.


## PWA repairs · 1.5.4

Phones and tablets use a full-width workspace with a navigation drawer. Camera, voice messages, scheduling, and upload management remain available from the + menu; shared media, pins, sharing, and group management are available from Conversation Options. Text fields render at 16px to prevent iOS focus zoom, while intentional accessibility zoom remains available.

Uploads save their source file once in IndexedDB and checkpoint small metadata records separately. Browsers that cannot persist File/Blob use an ArrayBuffer fallback. A pause or failure releases Send, completed files remain individually removable, and resumed background uploads never switch conversations or overwrite a prepared attachment. Successful uploads release their local file bytes.

Builds generate a versioned precache containing the complete boot graph. Offline reopen loads the shell and shows a reconnect screen for authenticated content; reconnect restores the existing session. Private APIs, media, and authenticated responses bypass the shell cache. Updates offer a user-controlled reload and wait for active calls/uploads to finish.

Run `npm run qa:pwa` against a dev server configured for the existing API, and `npm run qa:pwa:shell` against a production preview. `QA_SITE` overrides either URL; `QA_WEBKIT=1` runs the core browser checks in WebKit. QA uses the existing ignored `.private/qa.json` accounts. Browser/device emulation does not establish physical iPhone installed-PWA or background-transfer behavior.

## Drawing and camera · 1.7.4

Drawing uses the supplied light/dark design with a purple tool rail, a 1200 × 750 blank page, undo/redo, clear, expand and Send to Chat. Canvas options retain palettes, brush presets, larger sizes, zoom, PNG download and manual sketchbook saving. Existing drafts retain their original sizes and images. New drafts store their paper color so erasing and clearing remain consistent when reopened.

The camera has Photo/Video modes, a centered shutter, Flip and a settings tray for grid, timer and optional microphone recording. Video uses the browser MediaRecorder, stops at three minutes or approximately 90 MB, and offers a playable review before sending. Microphone recording is off until selected. Closing or account reset releases owned tracks; capture clones an active call camera rather than stopping the call.

Run `npm run qa:drawing-camera` with the existing ignored QA credentials (`QA_CREDENTIALS`) against a local server or the live site (`QA_SITE`). It verifies drawing tools and saved pages, desktop bounds, real photo/video capture with browser device fixtures, private uploads and recipient delivery. `npm run test:camera` exercises failed-send recovery and device cleanup against the local dev server. Physical cameras and Safari recording still require device verification.
