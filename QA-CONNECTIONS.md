# Connections tools in Vela 1.4.1

Scope: port the requested Connections features while excluding servers and channels. Existing chat, calling, films, expressions, games collections, themes, and creative studio remain in place.

## Implemented

- Chat: media gallery with filename/type/sender search and pagination; microphone voice notes with preview/discard/send; global message/media/people/settings/saved/pinned search; conversation pin/mute; message links and exact-message navigation; private hide/restore; account read-receipt preferences; browser notifications while Vela is running; expanded markdown and spoilers; message keyboard and context menus; resizable sidebar; working Save Message menu action.
- Groups: 20 members, rename, adding/removing friends, owner/admin management, owner protection, and active-call eviction when membership is removed. No server/channel creation was added.
- Calls/camera: remote-camera photographs; rolling 10–60 second replay clips; camera grid and 3/5 second capture timer. Replay segments stay in memory, clear when the call ends, and are encoded in a worker only when exported.
- Profiles: public drawing editor with undo; Tic-tac-toe, Connect Four, Pong against AI; five favorite films/shows through the existing catalog; custom status; Discord ID connection and Lanyard activity preview refreshed while the profile is open.
- Uploads: ten chat files per message; 512 MB per file; account-scoped IndexedDB file/job persistence; 8 MB multipart transfers; server checkpoints; pause/resume/retry/cancel; recovery after reload; private file access; shared storage reservation accounting and expired multipart cleanup.
- Media: music uploads/library and synchronized listening through the existing shared player; MKV/MOV conversion to MP4; imported VTT/SRT/LRC subtitle tracks, language/name editing, cue text/timestamp editing, creator-only update/delete and editable copies, display preferences and timing offset; explicit watched/unwatched flags, playback-time accounting across sessions, and preservation of previously inferred watched titles.
- Diagnostics: account/connection/call/upload/outbox information, retry/resync/restore actions, and diagnostic commands.

## Verification

Passed locally against the actual Worker, SQLite/R2 emulation, Firebase QA accounts, and Chrome at 1536 × 960:

- `scripts/test-connections-api.mjs`: group/admin/owner permissions, profile ownership, preferences, 512 MB rejection, multipart resume and retrying completion, attachment ownership, multiple attachments, idempotent sends, saved messages, global search, private hiding, receipt privacy, and access after removal.
- `scripts/qa-connections.mjs`: two accounts, real-time delivery, markdown/spoilers, context menu and saved-message flow, global-search jump, multiple file upload, gallery/private file links, profile status/drawing/game, recorded microphone preview/send, camera grid/timer. No browser exceptions.
- `scripts/qa-connections-resume.mjs`: interrupted a 17 MB transfer after its first part, paused, reloaded, resumed from the persisted file and server checkpoint, then sent the attachment.
- `scripts/qa-connections-groups.mjs`: group rename and admin controls, persisted pin/mute, sidebar drag, real catalog search and favorite, account privacy setting.
- `scripts/qa-connections-media.mjs`: two real WebRTC peers with Chrome test devices; remote photo and a decoded 10-second replay; original supplied audio playback; container conversion and decoded MP4; imported and displayed timed subtitles; watched flag after reload. Both MKV and MOV conversion paths were exercised during QA.
- Existing library, outbox, clipboard, creative, commands, expressions, and emoji-size regression suites passed. Syntax checks and production/GitHub builds passed.

Chrome test devices were used for camera/microphone QA. No AI audio was generated. Music QA used an existing sound asset.

Browser notifications require browser permission. The external Discord success path requires an account monitored by Lanyard; no personal Discord account was available to verify that connection live. Those requirements are stated in the interface rather than replaced with simulated activity.

## Release isolation

The primary checkout also contains separate, unfinished admin-console work. This release was prepared in `C:\Users\jayme\Downloads\Vela-Connections-release` from commit `050d3a2` and excludes that unrelated admin work. The original checkout and its admin changes were preserved.

Migration: run `worker/connections.sql` before deploying this Worker. It creates additive tables and migrates prior watched classifications once. It does not remove existing messages or media.

Publishing and production smoke-test evidence is recorded below after deployment.

Replay hardening: recording uses a fixed canvas size (up to 1280×720), preserving aspect ratio when the remote camera changes resolution, so adjacent AVC segments keep a compatible codec description. Capture runs on a timer while the replay buffer is active and clears with the call.

Production evidence (2026-10-25): the additive D1 migration and Worker deployment succeeded. GitHub Pages published the new bundle. Two separate signed-in Chrome contexts on the public site passed message delivery/formatting, Save Message, multipart attachment delivery, profile controls, actual WebRTC camera playback, bundled replay export, and decoding of the exported clip. The final replay revision also passed a local test that changed the live camera resolution during buffering. Browser notifications and a personal Lanyard identity remain dependent on the user’s browser permission/account.
