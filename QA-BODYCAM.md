# Themes, bodycam library and VELA commands

The shared Library contains 13 bodycam cases with original uploader thumbnails, channel names, runtimes and actual quality labels. Ten uploads are 1080p; the Gabby Petito and Chris Watts news uploads are 720p, and the official Connecticut Office of Inspector General Bristol release is 480p. Existing movies and series remain intact. The two existing uploads without artwork now use frames from their actual video files.

Type `/` in a conversation to see the command picker. Its VELA Bot category contains `/bodycam [search]` and `/help`. `/body cam` is also accepted. These create durable bot messages visible to all conversation members. Anyone in the conversation can search the embedded collection and click a thumbnail for authenticated playback. `/library`, `/movies` and `/saved` open existing surfaces locally; `/shrug [message]` sends a normal message.

Bot requests pass through the persistent outbox and retry with a stable request ID. The server verifies conversation membership and blocking, creates one message per request ID, and broadcasts through the existing user hubs. Bot cards contain catalog metadata only, with fresh playback credentials obtained when a viewer clicks. The requester can delete their own bot response; other members cannot impersonate or edit it.

Graphite, Midnight, Paper and Pine replace the old orange appearance. Every fresh page opening displays the theme chooser; the last selection is initially highlighted. Appearance and the top-bar palette button reopen it. The chooser preserves existing sign-ins and account preferences.

Verification completed:

- Every uploaded video decoded remotely; byte samples at the beginning, middle and end matched the local file. Anonymous access returned 401 and authenticated byte ranges returned 206.
- Two existing QA accounts received bot messages over the live WebSocket connection. Concurrent repeated requests produced exactly one stored message. Search, help, recipient playback, wrong-conversation access, request ownership and delete permissions passed.
- Library, command and outbox regressions, syntax checks and both builds passed.
- The repository's Discord reference tab was not open during this pass. The picker follows VELA's existing composer and desktop layout instead; no claim of a new live Discord comparison is made.

Live GitHub Pages browser verification passed: opening chooser, Paper and Graphite themes, real Library pictures, slash picker with VELA Bot filtering, shared 13-video response, EWU search, direct 1920x1080 playback and ten-second seeking. The video reached readyState 4 without a media error; the console had no warnings or errors. Screenshots and JSON verification reports are saved in the task outputs folder.
