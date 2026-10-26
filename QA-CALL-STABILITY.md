# Call stability · 1.5.3

Unexpected camera-track endings now trigger bounded recovery. Recovery keeps the user's camera intent, cancels when the camera is turned off or the call ends, rejects late capture results, and falls back from a removed saved camera to an available device. Cameras retain 1080p capture with a 30 FPS target to reduce capture and encode load.

Signaling reconnects reuse the current device identity. The call room preserves participant state for a 15-second reconnect window; explicit leave, group removal and device transfer still take effect immediately. Rejoining after a longer outage resets peer connections cleanly. Signaling requests have deadlines so a stalled request cannot leave recovery stuck forever.

ICE recovery, frame-stall detection and peer rebuilding preserve local tracks. Negotiation messages identify the peer-connection generation so delayed offers, answers and candidates from retired connections cannot damage a replacement connection. Congestion tuning reserves microphone bandwidth, uses current packet-loss samples instead of lifetime loss, caps video bitrate to available bandwidth and lowers camera encoding resolution under congestion. Explicit source-quality screen sharing remains available.

Speaking and statistics use separate events. Call controls retain their DOM nodes when markup is unchanged. Video/audio play requests run only when a bound media element is paused.

Local validation used three independent browser identities, real WebRTC, and Chrome camera fixtures:

- Six directions of decoded camera video; simultaneous camera and simulated screen share.
- Unexpected camera end and real capture reacquisition; manual off cancels recovery.
- Saved-device fallback; delayed capture result stops all late tracks after camera-off.
- Three interrupted signaling sockets retain device IDs, camera tracks and peer connections.
- Simultaneous ICE recovery; broken peer rebuild; long-outage lease expiry and rejoin.
- Explicit leave preserves other participants; rejoin restores all cameras; no engine errors.
- Packet-loss reset and bandwidth-envelope regression tests; syntax/build checks.

Run `node scripts/qa-call-recovery.mjs` with the isolated Worker on port 8787, Vite on port 5178, local D1 schema, and local-only test authentication. It never creates production identities. The three-person fixture uses 640×360/15 FPS capture to avoid saturating the workstation during failure injection.

Run `node scripts/qa-call-stability.mjs` with `QA_CREDENTIALS` pointing to the ignored QA account file and optional `QA_OUTPUT`. It uses two real QA accounts on the published site; `QA_LOCAL=1` substitutes the local GitHub frontend build for pre-publication checks against the live API. It verifies camera recovery, control identity, camera/photo/share transitions, reconnects, offline/online recovery, sender parameters, sustained decoded frames and leave/rejoin. Capture devices are simulated; physical webcam/driver and real adverse-network behavior require device testing.

No Discord reference tab was open during this repair. No new mobile/PWA behavior was added.
