# YouTube collection trial

**Historical trial, retired in 1.5.2.** The current library excludes YouTube-only entries and uses native media playback. See `QA-NATIVE-LIBRARY.md`. The notes below describe the earlier trial.

This release adds 64 YouTube catalog entries with real uploader thumbnails. Bodycam contains 40 videos exclusively from EWU Crime Storytime, Midwest Safety and Code Blue Cam, including the two existing downloaded files from those channels. Daily Dose of Internet contains 27 videos including the existing downloaded Buddy Was 100% Wrong upload. Older uploads are retained in All; other channels are excluded from Bodycam. Duplicate source IDs were removed.

Of the 64 new entries, 51 advertise embedded playback and 13 EWU videos disable embedding. Those 13 are labeled YouTube only and offer an explicit Open on YouTube link. Unavailable/members-only videos were excluded during discovery. YouTube controls playback, ads, region/age checks and quality. This trial offers solo YouTube playback; existing uploaded-file watch-together behavior is retained. No additional video files were uploaded to R2.

The iframe player uses the official YouTube IFrame API, validates source IDs, saves playback progress through the existing endpoint, and destroys the player on close. It exposes a clear fallback when YouTube refuses playback. Library search, filters and actual source labels are retained. `/bodycam` and `/dailydose` post shared, searchable VELA bot cards through the existing outbox.

The theme chooser now remembers a prior selection and does not reopen on refresh. The palette button and Appearance still open it manually.

Verification: command, Library and outbox regression suites passed. The live API verifies 40 Bodycam / 27 Daily Dose entries, source exclusivity, no duplicate source IDs, original thumbnails, authenticated access, YouTube provider resolution and recipient visibility of both bot commands. Live browser tests verified Daily Dose playback after a real YouTube ad, seeking, Midwest Safety bodycam playback, Code Blue Cam playback (time advancing), and the explicit EWU YouTube-only fallback. Refreshing a browser with an existing theme selection did not reopen the chooser. Additional browser results are recorded in the task outputs. The repository's Discord reference tab was not open; no fresh Discord comparison is claimed.

Per the user's latest instruction, administrator controls and hiding read receipts are deferred to the next pass. No account privilege or read-receipt changes were deployed in this release.
