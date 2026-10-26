# Native library and voice dock · 1.5.2

The voice dock now occupies normal sidebar layout. It follows the saved navigation width, keeps all four action buttons inside the panel, and sits above the account controls. Empty docks disappear after hangup.

The library and bot collections exclude YouTube-only catalog entries. Stored media overrides legacy provider metadata. Old YouTube IDs return an unavailable-file response instead of opening an iframe or linking out to YouTube. The redundant playback-provider filter and YouTube player were removed. This removes 62 YouTube-only entries from the visible collection and retains 25 direct media sources, including three Bodycam and two Daily Dose files.

Migration `worker/migrations/0004_native_video_cards.sql` refreshes the three existing VELA bot collection cards and their counts. It preserves messages from people and can run repeatedly. Video metadata, watch progress, and stored files are retained.

Shared playback now accepts the next stream after the host ends the previous stream. A remote stream ending no longer sets the flag used when someone deliberately dismisses shared playback.

Validation:

- Syntax checks; library, commands, expressions, outbox and native-library regression checks.
- Both frontend build modes and Wrangler deployment dry run.
- Two separate QA accounts joined a real WebRTC call. Voice controls fit at 220, 260, and 420 pixels of navigation width without overlapping chat or account controls; draft preserved.
- All three retained Bodycam and both Daily Dose files decoded at 1920×1080 on both accounts. Pause and seeking synchronized. Ending one stream and selecting the next worked repeatedly.
- Migration tested against copies of current catalog/cards; people messages preserved and repeat execution unchanged.

Run `scripts/qa-native-library.mjs` with `QA_CREDENTIALS` pointing to the ignored QA account file and optional `QA_OUTPUT`. `QA_LOCAL=1` serves the local GitHub build on the real site origin inside dedicated test browsers; the default checks the published site and validates all native media byte-range responses. Tests never use the user's live call or personal conversation.

No Discord reference tab was open during this fix; no fresh Discord comparison is claimed. Desktop scope only.
