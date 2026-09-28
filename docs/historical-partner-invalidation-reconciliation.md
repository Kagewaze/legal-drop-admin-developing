# Historical Partner invalidation reconciliation — Admin

Backend contract: `55ede77246ec7d6d47ed1f0662a0887b79cb4bf1` (inspected with `git show`; unchanged).
Admin base candidate: `0fadc801d225298459911d6048d756150227b20a`.
Fetched `origin/main`: `428ce8aff6641889cb5c05bb27dd2d50c2a70b27`.
Branch: `codex/admin-invalidation-ui`.

## Package review

The prior candidate changed only the `test` script to include `partnerCommission.test.js`.
It changed no dependency or version. This addition extends that script with
`paymentInvalidationReconciliation.test.js`; dependencies and the lockfile remain unchanged.

## Accepted contract

- `GET /api/admin/partners/payment-invalidation-reconciliation`, protected by backend
  `AuthGuard` and `AdminGuard`. The existing authenticated Admin client includes the API
  base prefix, so the component requests `/admin/partners/payment-invalidation-reconciliation`.
- Query: optional earning UUID `cursor`; integer `limit` 1–20, default 5.
- Success envelope: `response.data.data` contains `rows`, `nextCursor`, `limit`,
  `observedAt`, and `summary`. A null `nextCursor` ends forward pagination.
- Summary scope is `PAGE`. Counts: `totalEarningsInspected`, `consistent`,
  `missingReversal`, `missingRestoration`, `missingRecovery`, `otherInconsistent`, `unresolved`.
- `summary.totals` has separate currency entries with `resolvedEarnings`,
  `unresolvedEarnings` and exact decimal integer strings for `expectedReversalMinor`,
  `recordedReversalMinor`, `expectedRestorationMinor`, `recordedRestorationMinor`,
  `expectedRecoveryDueMinor`, `recordedRecoveryDueMinor`. Both sides exclude unresolved rows.
- Rows display only DTO fields: `reference`, `orderId`, `beneficiaryId`, `paymentIntentId`,
  `transactionId`, `currency`, the six expected/recorded amounts, `classification`, and
  the fixed diagnostic `reason` code. `earningId` is the React row key.
  The DTO has no separate provider-observation status, so the UI uses classification and reason.
- All ten classifications retain their exact codes and distinct readable labels:
  `CONSISTENT`, `MISSING_REVERSAL`, `EXCESS_REVERSAL`, `MISSING_RESTORATION`,
  `EXCESS_RESTORATION`, `MISSING_RECOVERY_OBLIGATION`, `EXCESS_RECOVERY_OBLIGATION`,
  `UNRESOLVED_PROVIDER_STATE`, `UNRESOLVED_OWNERSHIP`, `CURRENCY_MISMATCH`.

## Operator behavior

The Partners page mounts an idle inspection panel without requesting historical data.
Inspect first page, Next page, Previous page and Inspect this page again each request one
bounded page. The API provides only forward cursors; Previous page reuses a successfully
visited request cursor, including the initial cursorless request. No pages are prefetched.
Page-size choices are 5, 10 and 20. Changing the size clears the report and navigation
without issuing a request. A synchronous pending guard prevents duplicate submissions;
all inspection controls are disabled while loading.

Successful responses alone update the report and navigation. Failed requests leave the
last completed report visible and show a generic error without exposing provider errors.
The requested failed page can be explicitly requested again with the same action.
The client timeout is 45 seconds, above the documented provider observation budget.

Unresolved provider state, unresolved ownership and currency mismatch explicitly require
investigation without claiming a financial discrepancy. Null or unsafe amounts display
Unavailable, never assumed zero. Unknown classifications show a safe label and escaped
underlying code. Summary counts and monetary totals come directly from the backend;
minor-unit display uses the existing BigInt formatter. No financial targets are calculated.

Only normalized operational fields are rendered. Extra response fields are ignored;
there are no raw payload viewers, customer details, credentials or mutation controls.
Existing restoration/recovery balances, monthly reconciliation, ledger entries and
PARTIALLY_REVERSED/RESTORED handling are unchanged.

## Local validation

- Focused reconciliation UI: 34 tests passed.
- Existing Partner financial Admin: 10 tests passed in the same focused run.
- Full Admin suite (`npm test`): 82 tests passed.
- All request tests use in-memory synthetic responses; no backend or provider is contacted.
- `npm run build`: PASS (176 modules). The previously documented outdated Browserslist
  data warning remains non-failing; no dependency updates were needed.
- Changed-file ESLint: PASS for the new component, Partners page, reconciliation tests
  and existing Partner financial test harness, with zero warnings allowed.
- `git diff --check`: PASS. No unrelated validation failures were found.

Coverage includes all requested states/classifications, six authoritative monetary totals,
large integer strings, multiple currencies, next/back/reinspection, page-size changes,
duplicate submission, failed pagination, API errors, unknown classifications, privacy and
absence of financial mutation actions. Existing financial tests retain restoration/recovery
and monthly ledger coverage.

No backend edits, live Stripe operations, production access, push or deployment.
