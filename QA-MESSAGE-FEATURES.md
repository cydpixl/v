# Message feature improvements · October 31, 2026

Saved Messages now locates, centers, highlights and focuses the original message using the authenticated message-context endpoint. Search matches all words across message text, sender, conversation, attachment filenames and readable message previews. Result counts announce changes. Loading failures offer Retry without losing the query; failed opens and removals remain actionable.

Search Vela cancels requests as soon as the query changes. Outdated successes and failures cannot overwrite newer results. Filters cancel pending input debounces. Pagination serializes requests, deduplicates messages and retains loaded results when a later page fails. Retry repeats the failed cursor. Counts, loading state, empty state and errors are announced. Session checks tolerate routine profile refreshes while rejecting responses from prior sign-ins.

Message navigation ignores responses after the user selects another conversation, initiates a newer jump or changes accounts. It checks again after media hydration and invalidates older in-flight message refreshes before installing context.

The outbox invalidates in-flight completions on reset, including signing out and back into the same account. A new session can drain immediately without waiting for the previous request. Retry wakeups use only eligible conversation heads, preventing rapid polling behind a blocked message while preserving per-conversation ordering.

## Validation

- `npm run check` — passed, including the new search module.
- `npm run build` — passed. Vite retains the existing warning about the classic `vela-smtc.js` script.
- `npm run test:outbox` — passed, including same-account resets, independent new-session pumps and blocked retry timing.
- `npm run qa:message-features` — passed in desktop Chromium, with controlled delayed responses for query races, stale failures, filter debounce, pagination, retry, session changes, message navigation and bookmark failures.
- `QA_LIVE=1 npm run qa:message-features` — passed against the existing authenticated API using dedicated QA credentials. Created a unique QA message, bookmarked it, opened its exact location, searched for it, opened the result, then removed the bookmark and deleted the QA message. No uncaught browser JavaScript errors.

Run the browser suite against Vite with `VITE_API_ORIGIN` set to the existing backend and `QA_SITE` set to the dev URL (default `http://127.0.0.1:5196/`). Live checks use the ignored `.private/qa.json` or `QA_CREDENTIALS` path, matching existing QA scripts. Controlled response fixtures are test-only; product features use the real API.

Screenshots are written to `output/playwright/message-features/`. No backend changes or database migrations are required. These changes are local and have not been deployed. Physical device and WebKit verification was not performed for this change.
