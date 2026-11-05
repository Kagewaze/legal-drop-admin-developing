/* eslint-env node */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

// PAYOUT MONITOR — read-only, against the GET endpoints deployed in backend e6c0fa7 (see utils/payoutMonitor.js).
// Same harness as payoutPayments.test.js: components compile with the project's own esbuild and render to markup, and
// the HTTP client fails the test if anything requests while rendering. Every record below is synthetic.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const requested = [];
const refuse = (method) => (url) => {
  requested.push(`${method} ${url}`);
  throw new Error("render must not request");
};
const noop = () => {};
const STUBS = {
  "utils/customFetch.js": {
    default: { get: refuse("GET"), patch: refuse("PATCH"), post: refuse("POST"), put: refuse("PUT"), delete: refuse("DELETE") },
  },
  "utils/context.jsx": { useGlobalContext: () => ({ setGlobalLoading: noop }) },
};

const compiled = new Map();
const loaded = new Map();
const relative = (file) => path.relative(SRC, file).replaceAll("\\", "/");
function resolveFile(from, request) {
  const base = path.resolve(path.dirname(from), request);
  for (const candidate of [base, `${base}.jsx`, `${base}.js`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`cannot resolve ${request} from ${relative(from)}`);
}
async function compile(file) {
  if (compiled.has(file) || relative(file) in STUBS) return;
  const { code } = await transformWithEsbuild(readFileSync(file, "utf8"), file, {
    loader: file.endsWith(".jsx") ? "jsx" : "js",
    format: "cjs",
    jsx: "automatic",
  });
  compiled.set(file, code);
  for (const [, request] of code.matchAll(/require\("(\.[^"]+)"\)/g)) await compile(resolveFile(file, request));
}
function load(file) {
  const key = relative(file);
  if (key in STUBS) return STUBS[key];
  if (loaded.has(file)) return loaded.get(file).exports;
  const module = { exports: {} };
  loaded.set(file, module);
  new Function("require", "module", "exports", compiled.get(file))(
    (request) => (request.startsWith(".") ? load(resolveFile(file, request)) : require(request)),
    module,
    module.exports
  );
  return module.exports;
}
async function component(name) {
  const file = path.join(SRC, name);
  await compile(file);
  return load(file);
}
const html = (type, props) => renderToStaticMarkup(React.createElement(type, props));

const logic = await component("utils/payoutMonitor.js");
const { PayoutMonitorView } = await component("components/payouts/monitorViews.jsx");
const { PayoutMonitor } = await component("pages/payoutMonitor.jsx");

// ── Synthetic records shaped like the deployed API ─────────────────────────────────────────────────────────────
const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payoutOf = (n, overrides = {}) => ({
  id: ID(n),
  driverId: ID(900),
  driver: { id: ID(900), firstName: "Sample", lastName: "Driver", email: "sample.driver@example.com" },
  payeeType: "driver",
  status: "pending",
  amount: "42.50",
  currency: "CAD",
  stripeTransferId: null,
  deletedAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  orders: [],
  ...overrides,
});
const evidenceOf = (overrides = {}) => ({
  owedMinor: 4250,
  paidMinor: 0,
  remainingMinor: 4250,
  payments: [],
  settlement: null,
  openHold: null,
  holds: [],
  ...overrides,
});
const runOf = (overrides = {}) => ({
  id: ID(500),
  trigger: "WEEKLY",
  status: "COMPLETED",
  startedAt: "2026-11-01T05:00:00.000Z",
  finishedAt: "2026-11-01T05:02:00.000Z",
  interruptedAt: null,
  candidateCount: 3,
  claimFailures: 0,
  deferredCount: 1,
  deferredMinor: "1250",
  alertRequired: true,
  alertDelivery: "LOG_ONLY_EMAIL_NOT_CONFIGURED",
  outcomes: {
    counts: { SUCCEEDED: 2, DEFERRED_INSUFFICIENT_FUNDS: 1 },
    payouts: [
      { domain: "DRIVER", payoutId: ID(11), amountMinor: 4250, outcome: "SUCCEEDED" },
      { domain: "PARTNER", payoutId: ID(12), amountMinor: 1250, outcome: "DEFERRED_INSUFFICIENT_FUNDS" },
    ],
  },
  ...overrides,
});
const queueOf = (overrides = {}) => ({
  domain: "DRIVER",
  payoutId: ID(21),
  amountMinor: "1250",
  currency: "CAD",
  livemode: true,
  dueAt: "2026-10-15T00:00:00.000Z",
  queuedSince: "2026-10-18T05:00:00.000Z",
  lastDeferredAt: "2026-11-01T05:00:00.000Z",
  deferralCount: 3,
  reason: "DEFERRED_INSUFFICIENT_FUNDS",
  nextRetryAt: "2026-11-08T05:00:00.000Z",
  readinessVerifiedAt: null,
  ageDays: 20,
  overdue: true,
  urgent: true,
  ...overrides,
});
const UNEVIDENCED = {
  total: 2,
  byDomain: { DRIVER: 1, MARKETPLACE_SELLER: 1 },
  amountMinor: 3000,
  payouts: [
    { payoutId: ID(31), domain: "DRIVER", amountMinor: 1500, currency: "CAD", createdAt: "2026-09-01T00:00:00.000Z", deleted: false },
    { payoutId: ID(32), domain: "MARKETPLACE_SELLER", amountMinor: 1500, currency: "CAD", createdAt: "2026-09-02T00:00:00.000Z", deleted: true },
  ],
};
const LEGACY = [
  {
    payoutId: ID(41),
    domain: "PARTNER",
    businessId: ID(800),
    payoutStatus: "pending",
    amountMinor: "2000",
    currency: "CAD",
    deleted: false,
    hasRecordedTransfer: true,
    state: "LEGACY_AUTHORITY_REQUIRED",
  },
];
const ready = (value) => ({ loading: false, error: null, value });
const loading = { loading: true, error: null, value: null };
const failed = { loading: false, error: { kind: "unavailable", message: "Admin could not reach the server." }, value: null };
const monitorOf = (overrides = {}) => ({
  filters: { status: "", order: "DESC", page: 1 },
  setFilter: noop,
  clearFilters: noop,
  refresh: noop,
  list: ready({
    data: [
      payoutOf(1),
      payoutOf(2, { status: "completed", stripeTransferId: "tr_test_0001" }),
      payoutOf(3, { status: "completed" }),
      payoutOf(4, { status: "processing" }),
    ],
    meta: { page: 1, limit: 10, itemCount: 4, pageCount: 1 },
  }),
  evidence: {
    [ID(1)]: evidenceOf(),
    [ID(2)]: evidenceOf(),
    [ID(3)]: evidenceOf(),
    [ID(4)]: evidenceOf({ paidMinor: 2250, remainingMinor: 2000, openHold: { id: "hold-1" } }),
  },
  counts: ready({ all: 4, pending: 1, processing: 1, completed: 2, failed: 0 }),
  runs: ready([runOf()]),
  queue: ready([queueOf()]),
  unevidenced: ready(UNEVIDENCED),
  legacy: ready(LEGACY),
  ...overrides,
});
const view = (props = {}) => html(PayoutMonitorView, { monitor: monitorOf(), tab: "payouts", onTab: noop, onView: noop, ...props });
const RECEIPT_CLAIM = /received|deposited|in (the|their) (bank|account)|money arrived/i;

// ── Rules ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("codes, programmes and amounts read as words and exact figures", () => {
  assert.equal(logic.codeLabel("PROVIDER_REJECTED"), "Provider rejected");
  assert.equal(logic.codeLabel("DEFERRED_INSUFFICIENT_FUNDS"), "Deferred: platform balance too low");
  assert.equal(logic.codeLabel(null), "—");
  assert.equal(logic.domainLabel("MARKETPLACE_SELLER"), "Marketplace seller");
  assert.equal(logic.domainLabel("PARTNER"), "Partner Program");
  assert.equal(logic.minorOf("1250"), 1250);
  assert.equal(logic.minorOf(4250), 4250);
  assert.equal(logic.minorOf(null), null);
  assert.equal(logic.minorOf("12.5x"), null);
  assert.equal(logic.money("1250"), "$12.50");
  assert.equal(logic.money(undefined), "—");
});

test("each payout's payment record is summarised without claiming bank receipt", () => {
  const indicator = (payout, evidence) => logic.evidenceIndicator(payout, evidence);
  const cases = [
    [payoutOf(1), undefined, "Checking…"],
    [payoutOf(1), null, "Not available"],
    [payoutOf(1), evidenceOf(), "No payment yet"],
    [payoutOf(1, { status: "completed", stripeTransferId: "tr_test_0001" }), evidenceOf(), "Stripe transfer"],
    [payoutOf(1, { status: "pending", stripeTransferId: "tr_test_0001" }), evidenceOf(), "Transfer to reconcile"],
    [payoutOf(1, { status: "completed" }), evidenceOf({ paidMinor: 4250, remainingMinor: 0, settlement: { paymentCount: 1 } }), "Manual settlement"],
    [payoutOf(1, { status: "processing" }), evidenceOf({ paidMinor: 2250, remainingMinor: 2000, openHold: { id: "hold-1" } }), "On financial hold"],
    [payoutOf(1, { status: "completed" }), evidenceOf(), "No payment evidence"],
    [payoutOf(1, { status: "processing" }), evidenceOf({ paidMinor: 1000, remainingMinor: 3250 }), "Partly paid"],
  ];
  for (const [payout, evidence, label] of cases) {
    const result = indicator(payout, evidence);
    assert.equal(result.label, label);
    assert.doesNotMatch(`${result.label} ${result.detail}`, RECEIPT_CLAIM);
  }
  assert.equal(indicator(payoutOf(1, { stripeTransferId: "tr_test_0001" }), evidenceOf()).tone, "danger");
  assert.match(indicator(payoutOf(1), evidenceOf({ payments: [{ reversedAt: "2026-10-02T00:00:00.000Z" }] })).detail, /1 reversed payment/);
});

test("a transfer run reads its status, alert and outcomes from its own record", () => {
  const run = logic.transferRunView(runOf());
  assert.equal(run.status.label, "Completed");
  assert.equal(run.trigger, "Weekly driver and seller pass");
  assert.equal(run.alert.label, "Alert logged only: no email set up");
  assert.equal(run.deferredMinor, 1250);
  assert.deepEqual(run.counts.map((item) => [item.code, item.count]), [["SUCCEEDED", 2], ["DEFERRED_INSUFFICIENT_FUNDS", 1]]);
  assert.equal(run.payouts.length, 2);
  assert.equal(run.needsAttention, true, "the run required an alert");
  const stored = logic.transferRunView(runOf({ outcomes: JSON.stringify({ counts: { SUCCEEDED: 1 } }), alertRequired: false, alertDelivery: "NOT_REQUIRED" }));
  assert.deepEqual(stored.counts.map((item) => item.count), [1]);
  assert.equal(stored.alert.label, "No alert needed");
  assert.equal(stored.needsAttention, false);
  const interrupted = logic.transferRunView(runOf({ status: "INTERRUPTED", alertRequired: false, outcomes: "{}" }));
  assert.equal(interrupted.status.tone, "danger");
  assert.equal(interrupted.needsAttention, true);
  assert.equal(logic.transferRunView(runOf({ alertRequired: false, claimFailures: 2 })).needsAttention, true);
  assert.equal(logic.transferRunView(runOf({ trigger: "PARTNER_WEEKLY", outcomes: "not json" })).counts.length, 0);
});

test("a payout waiting for funding is marked by how long it has waited", () => {
  assert.deepEqual(logic.queueEntryView(queueOf()), { label: "Urgent", tone: "danger" });
  assert.deepEqual(logic.queueEntryView(queueOf({ urgent: false })), { label: "Overdue", tone: "warning" });
  assert.deepEqual(logic.queueEntryView(queueOf({ urgent: false, overdue: false })), { label: "Waiting", tone: "info" });
});

test("attention figures never turn an unknown into zero or a capped list into a total", () => {
  const byKey = (parts) => Object.fromEntries(logic.attentionItems(parts).map((item) => [item.key, item]));
  const unknown = byKey({ counts: failed, runs: failed, queue: loading, unevidenced: failed, legacy: failed });
  for (const item of Object.values(unknown)) {
    assert.equal(item.value, "—", `${item.key} is unknown`);
    assert.equal(item.tone, "neutral");
  }
  assert.equal(unknown.queue.detail, "Loading…");
  assert.equal(unknown.failed.detail, "Could not be read.");
  const fifty = Array.from({ length: 50 }, (_, index) => queueOf({ payoutId: ID(100 + index), urgent: false, overdue: index < 3 }));
  const known = byKey({ counts: ready({ failed: 0 }), runs: ready([]), queue: ready(fifty), unevidenced: ready(UNEVIDENCED), legacy: ready([]) });
  assert.equal(known.failed.value, "0");
  assert.equal(known.failed.tone, "success");
  assert.equal(known.queue.value, "50+");
  assert.match(known.queue.detail, /3 overdue · 0 urgent · first 50 loaded/);
  assert.equal(known.queue.tone, "warning");
  assert.equal(known.unevidenced.value, "2");
  assert.match(known.unevidenced.detail, /\$30\.00 · 1 driver, 1 seller/);
  assert.equal(known.legacy.value, "0");
  assert.equal(known.run.value, "None recorded");
  const latest = byKey({ runs: ready([runOf()]) });
  assert.equal(latest.run.value, "Completed");
  assert.equal(latest.run.tone, "warning", "the run required an alert");
});

// ── Rendered views ──────────────────────────────────────────────────────────────────────────────────────────────
test("the monitor shows status counts, payment evidence, transfer runs, the funding queue and exceptions", () => {
  const payouts = view();
  for (const text of [
    "Payout monitor",
    "Read-only",
    "Needs attention",
    "Failed driver payouts",
    "Completed without evidence",
    "Waiting for funding",
    "Legacy review needed",
    "Last transfer run",
    "All driver payouts",
    "Stripe transfer",
    "No payment evidence",
    "On financial hold",
    "No payment yet",
    "$42.50",
    "View details",
  ])
    assert.ok(payouts.includes(text), `the payouts tab shows ${text}`);
  assert.match(payouts, /aria-selected="true"[^>]*>Payouts</);
  const runs = view({ tab: "runs" });
  for (const text of [
    "Weekly driver and seller pass",
    "Alert logged only: no email set up",
    "Payouts considered",
    "Deferred: platform balance too low",
    "Payouts in this run (2)",
    "Partner Program",
  ])
    assert.ok(runs.includes(text), `the runs tab shows ${text}`);
  const queue = view({ tab: "queue" });
  for (const text of ["Urgent", "$12.50", "20 days", "Deferred: platform balance too low"]) assert.ok(queue.includes(text), `the queue tab shows ${text}`);
  const exceptions = view({ tab: "exceptions" });
  for (const text of [
    "Completed without payment evidence",
    "2 in all",
    "$30.00",
    "Marketplace seller",
    "Deleted",
    "Legacy payouts awaiting review",
    "Legacy review required",
    "Transfer recorded",
  ])
    assert.ok(exceptions.includes(text), `the exceptions tab shows ${text}`);
  for (const markup of [payouts, runs, queue, exceptions]) assert.doesNotMatch(markup, RECEIPT_CLAIM);
});

test("the monitor offers no control that changes anything", () => {
  const MUTATION = /record|update|set to|save|send|\bpay\b|retry|release|replay|escalat|adopt|reconcile|close|activate|enable|switch|transfer now|delete/i;
  for (const tab of ["payouts", "runs", "queue", "exceptions"]) {
    const markup = view({ tab });
    const labels = [...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(([, inner]) => inner.replace(/<[^>]+>/g, "").trim());
    assert.ok(labels.length > 0);
    for (const label of labels) assert.doesNotMatch(label, MUTATION, `"${label}" on the ${tab} tab`);
  }
  for (const file of ["utils/payoutMonitor.js", "components/payouts/usePayoutMonitor.js", "components/payouts/monitorViews.jsx", "pages/payoutMonitor.jsx"]) {
    const source = readFileSync(path.join(SRC, file), "utf8");
    assert.doesNotMatch(source, /customFetch\.(patch|post|put|delete)\b|method:\s*["'](PATCH|POST|PUT|DELETE)/i, `${file} only reads`);
  }
});

test("loading and failures are shown in place, section by section", () => {
  const waiting = view({
    monitor: monitorOf({ list: loading, counts: loading, runs: loading, queue: loading, unevidenced: loading, legacy: loading, evidence: {} }),
  });
  assert.match(waiting, /Loading payouts/);
  assert.match(waiting, /Refreshing…/);
  assert.match(waiting, /disabled=""/);
  const broken = view({ monitor: monitorOf({ list: failed }) });
  assert.match(broken, /This could not be loaded/);
  assert.match(broken, /Admin could not reach the server/);
  assert.match(broken, /Try again/);
  assert.match(view({ tab: "runs", monitor: monitorOf({ runs: failed }) }), /This could not be loaded/);
  assert.match(view({ tab: "runs", monitor: monitorOf({ runs: ready([]) }) }), /No transfer run recorded/);
  assert.match(view({ tab: "queue", monitor: monitorOf({ queue: ready([]) }) }), /Nothing is waiting for funding/);
  assert.match(view({ monitor: monitorOf({ evidence: {} }) }), /Checking…/);
});

test("the page renders its loading state and requests nothing while rendering", () => {
  requested.length = 0;
  const markup = html(PayoutMonitor, {});
  assert.match(markup, /Payout monitor/);
  assert.match(markup, /Loading payouts/);
  assert.deepEqual(requested, []);
});
