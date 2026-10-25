# Vela creative studio — 1.3.13

Adapted the existing Connections studio and its supplied artwork into Vela. Existing Vela camera capture, upload pipeline, authentication and outbox are retained.

Verified October 23, 2026:

- Syntax checks and fill-engine, library, outbox and clipboard regression checks passed; GitHub Pages production build passed.
- Real browser strokes appeared on the canvas and enabled Undo. Fill changed the background without replacing the stroke. Undo/redo and enlargement to 1600 × 1200 followed by Undo restored 1000 × 750.
- Saved a drawing, reloaded the app, and reopened its editable canvas through Sketchbook.
- A drawing sent between two dedicated QA accounts appeared exactly once on the recipient and decoded at 1000 × 750. Sender composer text remained intact.
- All nine coloring pages were present. Puppy PNG loaded at 600 × 600; fill stayed inside an outlined leg. Switching to Garden saved the previous page and loaded the vector page. Gap protection persisted.
- Imported a real PNG through the native file-chooser flow into Draw on a Photo.
- Final Blob-based Download saved a valid PNG to disk; its signature and 1000 × 750 dimensions were checked.
- The studio fit the 1280 × 720 desktop browser: no dialog scroll overflow and Send stayed visible.

Live verification completed October 24, 2026, against the newer production bundle, retaining subsequent Vela releases. `node scripts/qa-creative.mjs` passed: shared-image menu, fresh private file link, real pointer drawing, color picking, reply attachment, exactly one decoded recipient image, byte-identical original image, preserved composer text, no page errors, and an empty outbox. Screenshots and the machine-readable result are in the ignored `output/playwright/` directory.

Limitations: drafts are local to the current browser/device and origin. Physical pen/touch and mobile devices were not exercised.
