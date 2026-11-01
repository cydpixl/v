# Vela Shop integration

Desktop integration of the existing Ashlan Shop, with a Shop entry in Vela navigation and explicit Send item actions for conversations. Standalone Ashlan Shop remains unchanged.

Validated 2026-11-01:
- Full repository syntax checks and GitHub Pages build.
- Shop message Unicode round-trip, HTML escaping, image host validation, malformed message rejection, sidebar previews, and exact item deep links.
- Existing outbox tests, including retry and account isolation.
- Service-worker regression test: nested Shop navigation cannot overwrite or fall back to the Vela root shell.
- Real authenticated QA account: open Shop, inspect Day-o, select the second existing QA account, send via the normal message queue, open the delivered card in chat, and reopen the cosmetic in Shop.
- Chat draft preserved when opening and closing Shop.
- Short desktop sidebar keeps conversation rows reachable with the new navigation entry.

The isolated checkout starts from origin/main 8f76d8c. Unrelated edits in PIXL-Chat were not included. API/message storage, authentication and Worker routes were not changed. The release adds only frontend code and static shop files.

Physical phones, calls, and uploads are outside this change and were not retested.
