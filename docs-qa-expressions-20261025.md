# VELA expressions and video verification — 2026-10-25

Published to https://cydpixl.github.io/v/ with API at https://vela-cyd.cydpixl7.workers.dev.

## Changes
- Removed the dynamic picker import that failed in an already-open tab after a deployment deleted its old chunk. The Pages build preserves fingerprinted assets; the previously missing expression-picker-CJiLfbkm.js now returns HTTP 200.
- Emoji search covers standard and custom emojis. Added pack filtering, favorites, recent history, skin tones, paged results, and persistent Keep open with cursor-aware multi-insertion. Preserved per-emoji resizing and custom-token serialization.
- GIF discovery, search, quick categories, pagination, shared Reaction GIFs, favorites, recent sends, image fallback, explicit preview/send, request cancellation, stale-response protection and retry states.
- Fixed refreshed sticker favorites, including stickers received in a conversation. Fresh tickets still require current expression access. Increased collection limit to avoid dropping personal assets behind the expanded shared packs.
- Added 500 animated emojis and 100 animated GIFs, across Animated Animals, Animated Characters and Reaction GIFs. Every asset has unique source bytes and multiple different decoded animation frames. Added 42,804,823 bytes within the existing 8 GiB cap.
- Native videos: persistent speed selection, mute, J/L and arrow seeking, Space/K play, M mute, F fullscreen, next video, optional autoplay next, and direct-versus-YouTube filtering. Shared sessions disable personal speed, next and autoplay controls.
- Resync refreshes the playback ticket and waits for metadata before restoring position and play/pause state. Solo seeks and pause preserve the selected speed.

## Verified
- Syntax checks, expression regression tests, emoji sizing tests, library tests and outbox tests passed. GitHub and Worker production builds passed.
- Both QA accounts list all 600 new expressions. All 1,200 downloads passed content type, byte length and SHA-256 checks against the decoded source files.
- Live GIF search returns 24 results, pagination advances 24 to 48, and trending correctly stops near its provider offset boundary. Optimized GIF image URL decoded with HTTP 200/image-gif.
- Browser: picker opens on Pages, Reaction GIFs displays 100 images, Favorites preserves the selected GIPHY item, Recent contains the newly sent shared GIF, Cats search and Load more expand 24 to 48 results.
- Browser: Keep open appends 😀 then 😃 instead of replacing the first emoji; emoji favorites and pack selection work. Pack selector measured 335 px after fixing a layout collision. First 20 visible Animated Animals thumbnails decoded successfully.
- Browser + API: one external GIF, one newly added shared GIF and one newly added custom emoji delivered to the second account; recipient images decoded. Sent shared GIF was stored exactly once for both accounts.
- Sticker favorite reload tested for its owner and for the recipient with message-based access; both received usable fresh media tickets. Test favorite settings were restored.
- Native Daily Dose file decoded at 1920×1080. Speed 1.5× survived seeking, pause and Resync. Paused Resync restored position 78.633126 seconds and remained paused at 1.5×.
- Autoplay next advanced from Absolute Worst Home Inspector to Buddy Was 100% Wrong, which decoded at 1920×1080 and retained 1.5×. The test account's autoplay setting was switched back off.
- Shared playback decoded at 1920×1080 on two separate accounts and origins; observed positions 78.358785 / 78.381209 seconds. Both speed controls disabled. Closing the controller ended the test room.
- Existing session remained signed in after refresh; theme chooser did not reopen.

## Scope and limits
- Desktop browser verification only. Discord was not present in the available browser/app inventory, so no Discord reference interaction was possible.
- Existing YouTube entries remain subject to YouTube and account/organization restrictions. This change does not convert the remaining catalog or increase storage spending.
- Concurrent unfinished Connections/admin/upload/caption work in the main checkout was preserved. Deployment used an isolated release snapshot containing this task's changes only.

Proof images are saved in the chat workspace outputs/vela-animated-emoji.png and outputs/vela-video-controls.png. Asset provenance and hashes are in scripts/data/expression-expansion-20261025.json.
