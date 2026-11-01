# VELA 1.7.3 controls repair

Fixed the account status submenu being clipped by its scrolling parent and the mobile account bar being hidden by legacy responsive CSS. Presence changes save with feedback; custom status has a direct account-menu entry.

Blocking now supplies directional relationship state to the authenticated account, named blocked accounts, live refreshes to both accounts/devices, visible chat/friend/sidebar/profile states, and working Unblock actions in conversation options, profile information, and Settings > Blocked Accounts. Drafts and existing history remain available. Messaging, typing, read receipts, new calls, call rejoining and scheduled-message delivery enforce the block on the server. Blocking terminates existing direct calls. Mutual blocks remain in force until both accounts unblock.

Validation:
- npm run check and npm run build
- node scripts/test-relationships-api.mjs against a local Worker/D1: presence privacy and persistence, custom status, directional/mutual blocks, retained history, API restrictions, call eviction, actual scheduled-handler delivery prevention and recovery
- node scripts/test-connections-api.mjs: groups/permissions, resumable uploads, ownership, messages, bookmarks, search and receipts
- npm run test:outbox, npm run test:commands, npm run test:shop
- node scripts/qa-controls.mjs: two signed-in browser accounts, status selection/reload, custom status live updates, chat/profile/friend/settings blocking controls, sender/recipient banners, disabled controls, draft preservation, restored delivery; Chromium and WebKit
- Phone 390x844, tablet 768x1024, desktop 1440x960 and short desktop 1440x600
- Settings panels, Inbox and Help; no uncaught browser errors
- Worker deployment dry run

Browser tests use local fixture accounts and the existing Firebase QA login. The API suite requires a local Worker with TEST_AUTH=local-only and an API ticket secret, and the three worker SQL schemas. The scheduled check dispatches through Wrangler Local Explorer after the test message becomes due.

Physical installed iPhone/Android PWA testing was not performed.
