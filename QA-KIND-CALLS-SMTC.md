# VELA 1.5.5 — kinder messages, mobile calls, automatic Windows music

Messages use the same deterministic rewrite in the frontend and API. New messages, retries, forwarded text, edits, fullscreen chat and scheduled messages pass through it. Common profanity, separated spellings and several leetspeak variants get clean substitutions; direct personal insults such as “you're stupid”, “you're retarded” and “you're ugly” become compliments. Code, URLs and custom emoji identifiers stay intact. This is a bounded English ruleset, not a semantic model: it does not recognize every insult, slang variant or language. Existing message history is not rewritten.

Phones and tablets have their own bounded call pane and touch controls. Desktop resize settings no longer affect mobile, the resize grip is disabled, and redundant call-presence banners no longer push the composer out of landscape view. Fullscreen disables the floating chat on mobile and falls back to an overlay when element fullscreen is unavailable. Desktop chat shortcuts and resizing remain available.

SMTC detection starts at sign-in and selects the active Windows player rather than requiring Apple Music. It retries with capped backoff, immediately checks after focus/network recovery, isolates account changes from in-flight requests, distinguishes an explicit browser permission denial, supports paused tracks, and retains a deliberate opt-out. The upgrade migrates the former manual connection settings to automatic discovery. Sharing with friends remains opt-in. No address, port, credential or token entry is required. The Windows bridge must be running on this computer, and the browser can still require its own one-time local-device permission. The experimental `targetAddressSpace` fetch override was removed after native browser verification showed connection failures.

Verification on 2026-10-31:

- Full syntax checks, production and GitHub Pages builds, Worker bundle dry run.
- 14 rewrite cases plus idempotence, Unicode, links/code preservation and boundary cases.
- Existing call-quality, outbox and live music tests.
- Raw authenticated API checks for rewrite on create, idempotent retry, edit and schedule; test records cleaned up.
- Two existing QA accounts, real WebRTC signaling and decoded remote video using browser test cameras. Call, composer and controls verified at 320×640, 390×844, 430×932, 844×390, 390×490, 768×1024 and 1024×768.
- Mobile fullscreen, disabled floating chat, and fallback without element fullscreen; zero app page errors.
- Bridge fixture verifies auto-connect, old-setting migration, current-player selection, outage recovery, paused tracks, private default and persistent opt-out.
- Connected to the installed SMTC-Bridge.exe through Chrome with browser local-device permission granted. Physical iPhone/Android installed-PWA testing was not performed.

Commands: `npm run test:kind-messages`, `npm run qa:kind-calls`, `npm run qa:smtc`, `node scripts/test-kind-api.mjs`. The call QA uses the local `dist-gh` build under its production origin unless `QA_SITE` supplies a live site. Set `QA_NATIVE_BRIDGE=1` to include native SMTC testing; existing ignored `.private/qa.json` provides the test accounts.
