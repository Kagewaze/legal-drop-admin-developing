# Admin invalidation UI follow-up

Base: `428ce8aff6641889cb5c05bb27dd2d50c2a70b27` (fetched origin/main unchanged).
Branch: `codex/admin-invalidation-ui`.
Backend contract: `e750af43b620bbb2905613b31c18b17a545b0237`, read only.

## Contract and presentation

- Partner financial detail and earnings/payout balances display backend `restoredMinor` and `recoveryDueMinor` alongside the existing financial fields.
- Net liability uses backend `netCommissionLiabilityMinor`, `netEarnedMinor` or `netLiabilityMinor` as appropriate, without recomputing authority.
- Monthly reconciliation displays earned, signed reversals, restored and net liability. Integer strings from SQL SUM are formatted with BigInt, preserving large values and cents without floating-point dollar arithmetic. Missing/invalid values display Unavailable.
- Ledger labels EARNING, REVERSAL and RESTORATION, retaining signed amounts and showing basis/rate for earnings. Optional `restoresCommissionId` is labelled `Restores reversal` for operational use. Unknown type/status values have safe labels.
- Raw Stripe objects, secrets and financial credentials are never rendered. No mutation or payout execution path was added or changed.

## Local validation

- Focused Partner tests: **30 passed**.
  `node --test src/utils/partnerReferral.test.js src/utils/partnerCommission.test.js`
- Full Admin suite: **48 passed** (`npm test`). Includes 10 new rendered financial tests with offline synthetic fixtures.
- `npm run build`: PASS (production Vite). Existing outdated Browserslist data warning is non-failing.
- Changed-file ESLint: PASS (`src/pages/partners.jsx`, `src/utils/partnerCommission.js`, `src/utils/partnerCommission.test.js`).
- `git diff --check`: PASS.

Fixtures cover earning only, full/partial reversal, partial/full restoration, zero/positive recovery, RESTORATION linkage, numeric-string reconciliation, signed reversal rows, unknown types/statuses and authoritative net values. API requests and mutations are disabled in rendered tests.

No backend change, live Stripe call, refund, dispute, payout, transfer, push or deployment.
