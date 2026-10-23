# Vela 1.3.12 — Connections library

Verified October 23, 2026, with existing dedicated QA accounts.

## Scope

Restores Connections-style library access in Vela's existing application. Existing authentication, media records, playback API, messaging, expressions, calls and profile services are retained. This release does not migrate Connections' Firebase backend or claim complete parity with every Connections feature.

## Passed

- `npm run check`, `npm run test:library`, `npm run test:outbox`, `npm run test:clipboard`, `npm run build`, `npm run build:github`.
- Browser: retained 10 uploaded files rendered as 6 grouped titles; Library search, empty-result recovery, Shows filter, alphabetical sorting, and Continue Watching.
- Browser: uploaded series opened actual season/episode metadata and marked the retained episode available.
- Browser: saved a Library film to My List; confirmed the save persisted through a reload and appeared in My List.
- Browser: Saved Messages loaded existing bookmarks, searched them, and opened the original conversation.
- Live GitHub Pages: version 1.3.12, new navigation and Library present.
- Live playback: retained movie decoded at 1920px width, readyState 4, and advanced normally. Forward/back ten-second buttons changed time by exactly ten seconds while preserving pause. ArrowRight changed time by ten seconds; Space resumed playback.
- Live playback: opening and closing the Library picker preserved the player, decoded frames and running playback.
- Live browser: no warnings/errors recorded during these checks.
- Visual: final Library toolbar measured 68px high and had no horizontal overflow at the browser's 1280px desktop viewport.

## Limits

The local frontend can browse through the existing development proxy, but absolute signed production media URLs reject its local origin. Playback was therefore checked on the allowed live GitHub Pages origin. The catalog-free episode fallback is implemented; the available real series had catalog metadata. New upload, bookmark removal, two-account shared-seek behavior, and physical mobile devices were not exercised in this release. Shared seek uses the retained playback queue and room API.
