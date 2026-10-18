# Vela

Live site: https://cydpixl.github.io/v/

GitHub Pages hosts the frontend. The authenticated API, WebSocket signaling and private attachments use a separate backend. Firebase retains existing sign-ins. Calls use WebRTC.

## Build

Run `npm ci`, then `node scripts/build-github.mjs`. The GitHub Pages output is `docs/`; publish the main branch's `/docs` directory. `.env.github` contains the public API origin. Private credentials and QA accounts are excluded from the repository.

## Desktop

Direct and group messages, friend requests, inline edits, read receipts, voice/video, screen sharing, media focus, device selection and emoji search. This project is still under development; full Discord feature parity is unfinished. TURN relay fallback is not configured.

Emoji attribution: [Twemoji](https://github.com/jdecked/twemoji), CC-BY 4.0 graphics; emoji-mart metadata, MIT. See `public/emoji/ATTRIBUTION.txt`.
