# Moderation dashboard

Marketplace & Chat moderation for administrators: the report queue, a report's review and
decision, listing removal, account suspension and the audit trail. It talks to the backend's
`/api/admin/moderation/*` routes (backend `docs/admin-moderation-dashboard.md` and
`docs/marketplace-chat-safety.md`, production `071a452`) through the portal's own HTTP client.

## Screens

| Route | Screen | Backend |
|---|---|---|
| `/moderation` | Overview: counts, recent activity, safety feature status | `GET capabilities`, `GET reports?status=…&limit=1` ×4, `GET actions?limit=5` |
| `/moderation/reports` | Queue with filters and paging | `GET reports` |
| `/moderation/reports/:reportId` | One report: allegation, accounts, evidence, decision, actions, history | `GET reports/:id`, `POST …/review`, `POST …/resolve`, `POST …/evidence`, `POST listings/:kind/:id/remove\|restore`, `POST users/:id/suspend\|reinstate` |
| `/moderation/audit` | Audit history with filters and paging | `GET actions` |

Code: `src/pages/moderation*.jsx`, `src/components/moderation/`, `src/utils/moderation.js` (what the
screens say), `src/utils/moderationApi.js` (the routes).

## Rules the screens are built on

**Six facts that are never shown as one another:** report received · under review · decision
recorded · action applied · enforcement disabled · account actually restricted.

- **A decision is not an action.** Resolving a report as "content removed" or "account suspended"
  records what was concluded. Nothing is removed or suspended until the separate action succeeds,
  and the report says which of the two has happened.
- **A recorded suspension is not a restriction.** An account's label comes from `accessRestricted`,
  never from the recorded status alone. With enforcement off the result reads "Suspension recorded —
  not currently enforced." and warns that it could take effect if enforcement is activated later.
- **Feature states are read-only.** DISABLED, AVAILABLE or ENFORCED, exactly as
  `GET capabilities` reports them. There is no control that changes one.
- **An empty queue is explained.** While reporting is off nobody can file a report; the screens say
  so instead of implying there were no violations.
- **Identifiers, not invented names.** The queue and the audit trail carry IDs only, so IDs are
  shown. Names appear only where the backend returns them (a report's two accounts).
- **A refusal is always shown.** The portal's shared client is silent on `403`; these screens show
  every `401`, `403`, `404`, `409`, network failure and unreadable answer themselves.

## Privacy

- A report is requested only when its page is opened. Nothing is prefetched from the queue.
- The private conversation around a reported message is **not** loaded with the report. Opening it
  is an audited write (`POST …/evidence`): one explicit control, a confirmation that says the access
  is recorded, one request per confirmation, and the messages are discarded on "Hide".
- Reported photos and attachments are never loaded into the page; their links open on request.
- Nothing is written to browser storage or the console, and account IDs are passed between screens
  in router state, not in the address bar.

## Local development with synthetic data

Production has no reports, and moderation writes must never be tried against production. A local
stand-in for the backend routes serves synthetic data only:

```
npm run mock:api     # http://127.0.0.1:4010/api/
npm run dev:mock     # http://127.0.0.1:5179  (the portal, pointed at the mock)
```

Sign in with `admin@example.invalid` and any password (`customer@`, `former-admin@` and `expired@`
give the refused and expired cases). Scenarios and failures:

```
POST http://127.0.0.1:4010/__mock/reset
{ "scenario": "production" | "populated" | "enforced",
  "fail": [{ "method": "GET", "path": "admin/moderation/reports", "as": 500 | "network" | "platform" }] }
GET  http://127.0.0.1:4010/__mock/state      # what the dashboard has caused (audit rows, evidence views, …)
```

`production` is what production answers today (everything off, nothing filed); `enforced` turns
suspension enforcement on in the mock so that state can be exercised. `npm run dev` and
`npm run build` are unaffected and still use `public/env.js`.

## Tests

`npm test` includes `moderation.test.js` (wording and state rules), `moderationApi.test.js` (the
routes, against the in-memory stand-in) and `moderationComponents.test.js` (rendered screens and
source checks).

## Known limits

- Reloading or opening a moderation address directly returns 404 on the deployed static site, as
  for every other page of the portal: the site has no fallback to `index.html`. Navigate from the
  menu. The portal's sign-out redirect after a `401` lands on the same 404.
- The audit trail and the queue show account IDs; an administrator's or a user's name is not
  available from those routes.
