# Desktop development

Run `npm ci`, then `npm run desktop -- --port 5194`. The desktop command connects to the existing Vela API; `VELA_DEV_API` can select a local Worker. Sign in with your existing account. The first visit asks whether to open Simple Chat or Desktop. Opening preferences can be changed in Settings. Desktop can enter fullscreen on the first eligible user interaction when enabled. Simple Chat and installed VELA can run in a standalone window.

## Standalone apps

Register metadata in `src/desktop-catalog.js` and IDs in `src/app-ids.mjs`. Optional apps appear in the App Store and keep the existing 7–45 second install experience. Mount apps through `src/hub.js`; return a disposal function that removes listeners, observers, and ongoing work. The desktop provides window controls. Keep app navigation inside the app and use a unique workspace CSS class. Desktop icons also carry the app ID as a CSS class, so never style a bare `.music`, `.assistant`, or `.graphing` selector as a window.

## Integrations and account data

`worker/desktop-integrations.js` owns account-scoped graphs and Nova chats. The preview facade explicitly routes these endpoints to the desktop Worker. Groq credentials stay in Worker secrets; the browser receives only model metadata and the Desmos browser SDK key at runtime. Existing credentials are configured. Never copy `.private` or secrets into `public`, `docs`, or source control. All graph and chat operations must verify the signed-in owner.

Desmos drafts autosave per account on the current device. Save writes a revisioned graph to the account; stale revisions receive a conflict instead of overwriting another window. Export PNG and JSON remain available to preserve unsaved work.

## Assets and music

`public/wallpapers/catalog.json` lists 25 original-resolution character wallpapers with source URLs, dimensions, and hashes. Thumbnails are separate small WebP files, so opening Settings does not download every full-resolution image. Preserve user uploads when changing defaults.

`artwork/app-icons/prompts.json` records the built-in image generation prompts. Original PNGs live beside it; optimized desktop icons are in `public/app-icons/generated`. Official third-party logos remain separate. App Studio can override any name, description, or logo for all users with server-side administrator checks.

`src/music-curation.mjs` builds six collections from real tracks already in the shared music library. Playlist One and user-created playlists remain intact. Collaborative copies use batches of up to 40 metadata entries; audio remains in the existing shared library.

## Validation and release

Run `npm run check:desktop`, `npm run check`, and `npm run build`. Run `node scripts/qa-opening-mode.mjs` against localhost for the startup and messaging regression checks. Set `QA_MOBILE_WEBKIT=1` to run the phone workflow in WebKit.

Deploy the desktop Worker with `npx wrangler deploy --config wrangler.production.json`. Preserve the legacy MAIN service and all existing secrets. GitHub Pages publishes `docs` through the existing workflow after source is pushed to main. Test the actual published URL; a successful build alone is not UI acceptance.
