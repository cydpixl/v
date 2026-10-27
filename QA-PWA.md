# Vela 1.5.4 PWA verification

Tested October 27, 2026 against the existing authenticated API using the retained QA account pair.

- Chromium and WebKit: widths 320, 390, 430, 650, 768, 899, 900, 1024, 1099, 1100, 1200 and 1536; no page overflow, usable composer width and contained header actions.
- Navigation closes when reopening the current conversation. Hidden navigation is inert. Drafts survive keyboard-sized viewports and navigation.
- Mobile settings, expression picker, scheduling, shared media and attachment management remain reachable. Text fields render at least 16px.
- Real multipart file delivery verified against exact bytes at the recipient. Multi-file selection and individual removal passed.
- Forced upload failure releases Send. Retrying resumes the same saved upload and clears the error state.
- Chromium and WebKit: a 17 MB file pauses after part 1, survives reload, resumes server checkpoints and sends. WebKit's File/Blob persistence failure uses the ArrayBuffer fallback.
- Two-account WebRTC: receiver decodes camera video while the phone layout keeps the composer and Send visible. Browser capture fixtures were used.
- Production-build shell: complete boot graph and install icons precached. First offline reopen boots; signed-in offline startup shows recovery, then reconnect restores the session and draft.
- Service-worker update preserves the current form, offers a controlled reload and clears only Vela-owned caches.
- Regression checks: syntax, production build, outbox, clipboard, social parsing and library state passed.
- Live deployment: GitHub build and Pages deployment succeeded. The public site passed the Chromium upload/retry/resume suite, bidirectional remote-camera decoding, unavailable-storage fallback and signed-in offline recovery with zero page errors. WebKit also verified real file delivery on the public site; injected interruption tests use the local proxy because service-worker-controlled WebKit requests can bypass browser interception.

The local API proxy preserves upload bytes and supplies the production Origin for API/WebSocket verification. Playwright's WebKit request interception drops Blob request bodies, so body-forwarding tests use that proxy or the live site.

Physical iPhone/Android installed-PWA keyboard, OS file picker, background suspension and background uploads are not established by desktop browser emulation. Vela preserves resumable files on the device; it does not promise transfers while the OS suspends it. Offline startup does not expose cached private conversations.
