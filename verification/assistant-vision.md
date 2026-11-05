# Vela AI image reading — verified 2026-11-04

Scope: image reading only, explicitly requested after the games work was paused. Unfinished game sources, the game storefront and the earlier media-resizing branch were excluded from this release.

Implemented: JPEG/PNG/WebP attachments (picker, clipboard and file drop), removable previews, up to three images, image-only prompts, browser image compression, automatic Qwen 3.8 vision routing, saved private image metadata with authenticated retrieval, follow-up image context, deletion of conversation images, and a composer that waits for model configuration.

Limits: 20 MB original files, 40 megapixels maximum decode, resized to at most 1600 px and 190 KB per image, three most recent images included visually in provider requests, last 30 messages retained as provider context, 100 MB of image storage per account. Images and prompts are sent to the configured Groq provider for processing. Secret keys remain server-side.

Validation:
- npm run check and npm run build passed in an isolated release worktree.
- node scripts/test-desktop-integrations.mjs passed existing text-only AI, saved history, ownership and graph regressions.
- node scripts/test-assistant-vision.mjs passed forced vision routing, private image ownership, metadata-only chat history, repeated-request idempotency, follow-up visual context, provider three-image limit, malformed input rejection and deletion cleanup.
- Actual Groq calls through an isolated local Cloudflare Worker correctly read VELA 7392 and identified a blue circle and orange square in an uploaded image. Follow-up returned 7392. Saved images reloaded and the composer fit at 540 px.
- Actual deployed application at https://vela-desktop.cydpixl7.workers.dev and main https://cydpixl.github.io/v/ passed the same recognition, follow-up question and saved image after closing/reopening ChatGPT. Dedicated QA conversations and their uploaded objects were deleted (HTTP 200).
- Screenshots were visually inspected. Physical iPhone and HEIC inputs were not tested; HEIC is not advertised as supported.

Local evidence: output/playwright/assistant-vision/ and output/playwright/assistant-vision-live/. Credentials and .dev.vars are ignored and not included in commits.
