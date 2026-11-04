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

// PAYOUT MANAGEMENT (E1), against the contract deployed in backend e6c0fa7:
//   PATCH /payouts/:id/status — completing a DRIVER payout needs one verified external payment that completes it;
//   completed is final; a seller payout is never completed by a status change;
//   GET /payouts/:id/external-payments — owed, paid, remaining, payments, settlement, holds.
// Same harness as moderationComponents.test.js: components are compiled with the project's own esbuild and rendered
// to markup, and the HTTP client fails the test if anything requests while rendering.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const requested = [];
const refuse = (method) => (url) => {
  requested.push(`${method} ${url}`);
  throw new Error("render must not request");
};
const noop = () => {};
let listState = { payouts: [], fetchPayouts: noop, currentPage: 1, setCurrentPage: noop, pageCount: 1 };
const STUBS = {
  "utils/customFetch.js": { default: { get: refuse("GET"), patch: refuse("PATCH"), post: refuse("POST") } },
  "utils/context.jsx": { useGlobalContext: () => ({ setGlobalLoading: noop }) },
  "utils/payoutsContext.jsx": { usePayoutsContext: () => listState },
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

const logic = await component("utils/payoutPayments.js");
const views = await component("components/payouts/payoutEvidence.jsx");
const { RecordManualPayment } = await component("components/payouts/recordManualPayment.jsx");
const { UpdatePayoutStatus } = await component("components/payouts/updatePayoutStatus.jsx");
const { PayoutDetails } = await component("components/payouts/payoutDetails.jsx");
const { Payouts } = await component("pages/payouts.jsx");
const { settlementStatusLabel } = await component("utils/payoutStatus.js");

// ── Synthetic records shaped like the deployed API ─────────────────────────────────────────────────────────────
const DRIVER_ID = "00000000-0000-4000-8000-0000000000d1";
const payoutOf = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  driverId: DRIVER_ID,
  driver: { id: DRIVER_ID, firstName: "Sample", lastName: "Driver", email: "sample.driver@example.com", phoneNumber: "+1 416 555 0100" },
  payeeType: "driver",
  status: "pending",
  amount: "42.50",
  currency: "CAD",
  stripeTransferId: null,
  transferredAt: null,
  failureReason: null,
  deletedAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  orders: [{ trackingCode: "TESTTRACK1", section: "A", fee: "12.50", status: "delivered" }],
  ...overrides,
});
const evidenceOf = (overrides = {}) => ({
  payoutId: payoutOf().id,
  owedMinor: 4250,
  paidMinor: 0,
  remainingMinor: 4250,
  payments: [],
  settlement: null,
  openHold: null,
  holds: [],
  ...overrides,
});
const paymentOf = (overrides = {}) => ({
  id: "pay-1",
  holdId: null,
  amountMinor: 4250,
  currency: "CAD",
  paymentMethod: "E_TRANSFER",
  paymentReference: "CA8XJ2K4Q9",
  paidOn: "2026-11-03",
  recipientId: DRIVER_ID,
  evidenceReference: "EVID-2026-11-0012",
  recordedBy: "admin-7777",
  recordedAt: "2026-11-04T15:00:00.000Z",
  reversedAt: null,
  ...overrides,
});
const settled = () =>
  evidenceOf({
    paidMinor: 4250,
    remainingMinor: 0,
    payments: [paymentOf()],
    settlement: { id: "set-1", amountMinor: 4250, currency: "CAD", paymentCount: 1, evidenceReference: "EVID-2026-11-0012", approvedBy: "admin-7777", createdAt: "2026-11-04T15:00:00.000Z" },
  });
const validForm = (overrides = {}) => ({
  paymentMethod: "E_TRANSFER",
  paymentReference: "  CA8XJ2K4Q9 ",
  paidOn: "2026-11-03",
  evidenceReference: " EVID-2026-11-0012 ",
  recipientVerified: true,
  referenceVerified: true,
  ...overrides,
});
const TODAY = "2026-11-04";
const RECEIPT_CLAIM = /received|deposited|in (the|their) (bank|account)|money arrived/i;

// ── Money and dates ─────────────────────────────────────────────────────────────────────────────────────────────
test("CAD amounts convert exactly between the API's decimal strings and minor units", () => {
  assert.equal(logic.toMinor("52.92"), 5292);
  assert.equal(logic.toMinor("52.9"), 5290);
  assert.equal(logic.toMinor("52"), 5200);
  assert.equal(logic.toMinor(52.92), 5292);
  assert.equal(logic.toMinor("abc"), null);
  assert.equal(logic.toMinor("1.234"), null);
  assert.equal(logic.minorToDecimal(5292), "52.92");
  assert.equal(logic.minorToDecimal(2000), "20.00");
  assert.equal(logic.formatCad(5292), "$52.92");
  assert.equal(logic.formatCad(null), "—");
});

test("the local date is written YYYY-MM-DD", () => {
  assert.equal(logic.localToday(new Date(2026, 10, 4, 23, 30)), "2026-11-04");
  assert.equal(logic.localToday(new Date(2026, 0, 9, 1, 0)), "2026-01-09");
});

// ── What the backend accepts ────────────────────────────────────────────────────────────────────────────────────
test("a manual payment is offered for open driver payouts, reserving pending and failed ones first", () => {
  assert.deepEqual(logic.manualPaymentAvailability(payoutOf(), evidenceOf()), { available: true, reason: null, needsReservation: true });
  assert.deepEqual(logic.manualPaymentAvailability(payoutOf({ status: "failed" }), evidenceOf()), { available: true, reason: null, needsReservation: true });
  assert.deepEqual(logic.manualPaymentAvailability(payoutOf({ status: "processing" }), evidenceOf()), { available: true, reason: null, needsReservation: false });
  // From the list, before evidence is loaded.
  assert.equal(logic.manualPaymentAvailability(payoutOf()).available, true);
});

test("a manual payment is never offered where the backend refuses it", () => {
  const blocked = (payout, evidence) => logic.manualPaymentAvailability(payout, evidence);
  assert.match(blocked(payoutOf({ status: "completed" })).reason, /final/i);
  assert.match(blocked(payoutOf({ payeeType: "seller" })).reason, /seller/i);
  assert.match(blocked(payoutOf({ payeeType: "seller" })).reason, /Stripe transfer|recorded settlement/i);
  assert.match(blocked(payoutOf({ stripeTransferId: "tr_1Q2w3E4r5T6y" })).reason, /reconcile/i);
  assert.match(blocked(payoutOf({ deletedAt: "2026-11-01T00:00:00.000Z" })).reason, /deleted/i);
  assert.match(blocked(payoutOf({ status: "processing" }), settled()).reason, /settlement/i);
  assert.equal(blocked(payoutOf({ status: "processing" }), evidenceOf({ remainingMinor: 0 })).available, false);
  for (const payout of [payoutOf({ status: "completed" }), payoutOf({ payeeType: "seller" }), payoutOf({ stripeTransferId: "tr_x" })])
    assert.equal(blocked(payout).available, false);
});

test("status changes never include completed and stop where the backend refuses them", () => {
  const values = (payout, evidence) => logic.statusChangeOptions(payout, evidence).map((option) => option.value);
  assert.deepEqual(values(payoutOf({ status: "pending" })), ["processing", "failed"]);
  assert.deepEqual(values(payoutOf({ status: "processing" })), ["pending", "failed"]);
  assert.deepEqual(values(payoutOf({ status: "failed" })), ["pending", "processing"]);
  assert.deepEqual(values(payoutOf({ status: "completed" })), []);
  assert.deepEqual(values(payoutOf({ stripeTransferId: "tr_1Q2w3E4r5T6y" })), []);
  assert.deepEqual(values(payoutOf({ status: "processing" }), evidenceOf({ openHold: { id: "hold-1" } })), []);
  for (const status of ["pending", "processing", "failed"]) {
    assert.ok(!values(payoutOf({ status })).includes("completed"));
    assert.ok(!values(payoutOf({ status, payeeType: "seller" })).includes("completed"));
  }
  assert.match(logic.statusChangeBlockedReason(payoutOf({ status: "completed" })), /final/i);
  assert.match(logic.statusChangeBlockedReason(payoutOf({ status: "processing" }), evidenceOf({ openHold: { id: "hold-1" } })), /hold/i);
  assert.match(logic.statusChangeBlockedReason(payoutOf({ stripeTransferId: "tr_1Q2w3E4r5T6y" })), /Stripe/);
  assert.equal(logic.statusChangeBlockedReason(payoutOf()), null);
});

test("the evidence form is checked the way the backend checks it", () => {
  const errorsOf = (form) => logic.validateManualPayment(form, { today: TODAY }).errors;
  assert.deepEqual(logic.validateManualPayment(validForm(), { today: TODAY }), { ok: true, errors: {} });
  const empty = errorsOf({});
  for (const field of ["paymentMethod", "paymentReference", "paidOn", "evidenceReference", "recipientVerified", "referenceVerified"])
    assert.ok(empty[field], `${field} is required`);
  assert.ok(errorsOf(validForm({ paymentMethod: "WIRE" })).paymentMethod);
  assert.ok(errorsOf(validForm({ paymentReference: "-- -" })).paymentReference, "needs 3 letters or digits");
  assert.ok(errorsOf(validForm({ paymentReference: "A".repeat(121) })).paymentReference);
  assert.ok(errorsOf(validForm({ paidOn: "2026-11-05" })).paidOn, "not in the future");
  assert.ok(errorsOf(validForm({ paidOn: "2026-02-30" })).paidOn, "a real date");
  assert.ok(errorsOf(validForm({ paidOn: "03/11/2026" })).paidOn);
  assert.equal(errorsOf(validForm({ paidOn: TODAY })).paidOn, undefined);
  assert.ok(errorsOf(validForm({ evidenceReference: "ab" })).evidenceReference);
  assert.ok(errorsOf(validForm({ evidenceReference: "E".repeat(201) })).evidenceReference);
  assert.ok(errorsOf(validForm({ evidenceReference: "EVID\u0007" })).evidenceReference, "printable only");
  assert.ok(errorsOf(validForm({ recipientVerified: false })).recipientVerified);
  assert.ok(errorsOf(validForm({ referenceVerified: false })).referenceVerified);
});

test("the completion request carries exactly the evidence fields, for the amount still owed", () => {
  const body = logic.buildCompletionRequest(validForm(), payoutOf(), evidenceOf());
  assert.deepEqual(Object.keys(body).sort(), [
    "evidenceReference",
    "paidOn",
    "paymentMethod",
    "paymentReference",
    "recipientId",
    "recipientVerified",
    "referenceVerified",
    "settledAmount",
    "status",
  ]);
  assert.deepEqual(body, {
    status: "completed",
    paymentMethod: "E_TRANSFER",
    paymentReference: "CA8XJ2K4Q9",
    paidOn: "2026-11-03",
    settledAmount: "42.50",
    recipientId: DRIVER_ID,
    recipientVerified: true,
    evidenceReference: "EVID-2026-11-0012",
    referenceVerified: true,
  });
  // A held payout is completed by its remainder, not its full amount.
  assert.equal(logic.buildCompletionRequest(validForm(), payoutOf(), evidenceOf({ paidMinor: 2250, remainingMinor: 2000 })).settledAmount, "20.00");
});

test("a refusal is explained with the backend's own words and the safe next step", () => {
  const refusal = (message, status = 400) => ({ response: { status, data: { message } } });
  assert.equal(logic.refusalMessage(refusal("The date paid must be a real date, not in the future")), "The date paid must be a real date, not in the future");
  assert.match(logic.refusalMessage(refusal(["paidOn must match", "status must be valid"])), /paidOn must match.*status must be valid/);
  assert.match(logic.refusalMessage(refusal("COMPLETED_PAYOUT_IS_FINAL: a completed payout cannot change status")), /final/i);
  assert.match(logic.refusalMessage(refusal("Provider-managed payout requires reconciliation")), /escalate/i);
  assert.match(logic.refusalMessage(refusal("A Stripe transfer for this payout may already exist: reconcile it")), /escalate/i);
  assert.match(logic.refusalMessage(refusal("This payment reference is already recorded against a payout")), /never invent/i);
  assert.match(logic.refusalMessage(refusal("Forbidden", 403)), /administrator/i);
  assert.match(logic.refusalMessage({ message: "Network Error" }), /could not reach|connection/i);
  assert.match(logic.refusalMessage(undefined), /could not/i);
});

test("a settlement is verified only when the payments complete the payout", () => {
  assert.equal(logic.verifySettlement(settled()).ok, true);
  assert.equal(logic.verifySettlement(evidenceOf()).ok, false);
  assert.equal(logic.verifySettlement({ ...settled(), remainingMinor: 100 }).ok, false);
  assert.equal(logic.verifySettlement({ ...settled(), payments: [paymentOf({ reversedAt: "2026-11-04T16:00:00.000Z" })] }).ok, false);
  assert.equal(logic.verifySettlement(null).ok, false);
});

test("status labels separate the evidence behind a completion and never claim bank receipt", () => {
  const view = (payout, evidence) => logic.payoutStatusView(payout, evidence);
  assert.equal(view(payoutOf()).label, "Pending");
  assert.equal(view(payoutOf({ status: "processing" })).label, "Processing");
  assert.equal(view(payoutOf({ status: "failed" })).label, "Failed");
  assert.equal(view(payoutOf({ status: "completed" })).label, settlementStatusLabel("completed"));
  assert.equal(view(payoutOf({ status: "completed", stripeTransferId: "tr_1Q2w3E4r5T6y" })).label, "Transfer completed");
  assert.equal(view(payoutOf({ status: "completed" }), settled()).label, "Manual settlement recorded");
  assert.equal(view(payoutOf({ status: "completed" }), evidenceOf()).label, "Completed — no payment evidence");
  assert.equal(view(payoutOf({ status: "completed" }), evidenceOf()).tone, "warning");
  for (const [payout, evidence] of [
    [payoutOf({ status: "completed" })],
    [payoutOf({ status: "completed", stripeTransferId: "tr_1Q2w3E4r5T6y" })],
    [payoutOf({ status: "completed" }), settled()],
    [payoutOf({ status: "completed" }), evidenceOf()],
  ]) {
    const { label, detail } = view(payout, evidence);
    assert.doesNotMatch(`${label} ${detail}`, RECEIPT_CLAIM);
  }
});

// ── Rendered views ──────────────────────────────────────────────────────────────────────────────────────────────
test("the evidence panel shows the settlement and each payment recorded outside Stripe", () => {
  const markup = html(views.PaymentEvidencePanel, { payout: payoutOf({ status: "completed" }), evidence: settled() });
  for (const text of ["Payment evidence", "Manual settlement recorded", "$42.50", "$0.00", "Interac e-Transfer", "CA8XJ2K4Q9", "EVID-2026-11-0012", "2026-11-03"])
    assert.ok(markup.includes(text), `shows ${text}`);
  assert.doesNotMatch(markup, RECEIPT_CLAIM);
});

test("the evidence panel shows an open hold, reversed payments and unevidenced completions", () => {
  const held = html(views.PaymentEvidencePanel, {
    payout: payoutOf({ status: "processing" }),
    evidence: evidenceOf({
      paidMinor: 2250,
      remainingMinor: 2000,
      payments: [paymentOf({ amountMinor: 2250 }), paymentOf({ id: "pay-0", paymentReference: "OLDREF77", reversedAt: "2026-11-02T10:00:00.000Z" })],
      openHold: { id: "hold-1", reason: "PARTIAL_EXTERNAL_PAYMENT", payoutAmountMinor: 4250, placedAt: "2026-11-04T14:00:00.000Z" },
    }),
  });
  assert.ok(held.includes("financial hold"), "names the hold");
  assert.ok(held.includes("$20.00"), "shows the remainder");
  assert.ok(held.includes("Standing") && held.includes("Reversed"), "marks each payment's state");
  const unevidenced = html(views.PaymentEvidencePanel, { payout: payoutOf({ status: "completed" }), evidence: evidenceOf() });
  assert.match(unevidenced, /no payment evidence/i);
  assert.match(unevidenced, /reconcile/i);
  const stripe = html(views.PaymentEvidencePanel, { payout: payoutOf({ status: "completed", stripeTransferId: "tr_1Q2w3E4r5T6y", transferredAt: "2026-11-04T15:00:00.000Z" }), evidence: evidenceOf() });
  assert.ok(stripe.includes("tr_1Q2w3E4r5T6y"));
});

test("the payment form asks for every piece of evidence and fixes the amount to what is owed", () => {
  const markup = html(views.ManualPaymentForm, {
    payout: payoutOf({ status: "processing" }),
    remainingMinor: 4250,
    values: { paymentMethod: "", paymentReference: "", paidOn: "", evidenceReference: "", recipientVerified: false, referenceVerified: false },
    errors: {},
    onChange: noop,
    today: TODAY,
  });
  for (const label of ["Payment method", "Payment reference", "Date paid", "Evidence reference", "Sample Driver", "$42.50"]) assert.ok(markup.includes(label), `shows ${label}`);
  for (const method of logic.PAYMENT_METHODS) assert.ok(markup.includes(`value="${method.value}"`), `offers ${method.value}`);
  assert.ok(markup.includes(`max="${TODAY}"`), "no future date can be picked");
  assert.equal((markup.match(/type="checkbox"/g) || []).length, 2, "recipient and reference attestations");
  assert.doesNotMatch(markup, /name="settledAmount"|id="settledAmount"/, "the amount is not editable");
  const withErrors = html(views.ManualPaymentForm, {
    payout: payoutOf({ status: "processing" }),
    remainingMinor: 4250,
    values: { paymentMethod: "", paymentReference: "x", paidOn: "", evidenceReference: "", recipientVerified: false, referenceVerified: false },
    errors: { paymentReference: "A payment reference needs at least 3 letters or digits" },
    onChange: noop,
    today: TODAY,
  });
  assert.ok(withErrors.includes("A payment reference needs at least 3 letters or digits"));
  assert.ok(withErrors.includes('aria-invalid="true"'));
});

test("the review states what will be recorded and that completed is final", () => {
  const request = logic.buildCompletionRequest(validForm(), payoutOf({ status: "processing" }), evidenceOf());
  const markup = html(views.PaymentReview, { payout: payoutOf({ status: "processing" }), request });
  for (const text of ["$42.50", "Sample Driver", "Interac e-Transfer", "CA8XJ2K4Q9", "2026-11-03", "EVID-2026-11-0012"]) assert.ok(markup.includes(text), `shows ${text}`);
  assert.match(markup, /final/i);
});

test("the status form never offers completed", () => {
  const markup = html(views.StatusChangeForm, { payout: payoutOf({ status: "pending" }), evidence: evidenceOf(), value: "", onChange: noop });
  assert.ok(markup.includes('value="processing"') && markup.includes('value="failed"'));
  assert.ok(!markup.includes('value="completed"'));
  assert.ok(!markup.includes('value="pending"'), "the current status is not offered");
  assert.match(markup, /Record payment/i, "points to the evidence-backed route");
});

test("the payout modals render a loading state and request nothing while rendering", () => {
  requested.length = 0;
  for (const type of [RecordManualPayment, UpdatePayoutStatus, PayoutDetails]) {
    const markup = html(type, { id: payoutOf().id, closeModal: noop, refresh: noop });
    assert.match(markup, /Loading/);
    assert.match(markup, /role="dialog"/);
  }
  assert.deepEqual(requested, []);
});

test("the payouts list offers each action only where the backend accepts it", () => {
  listState = {
    ...listState,
    payouts: [
      payoutOf({ id: "11111111-1111-4111-8111-111111111111", status: "pending" }),
      payoutOf({ id: "22222222-2222-4222-8222-222222222222", status: "completed" }),
      payoutOf({ id: "33333333-3333-4333-8333-333333333333", status: "processing" }),
    ],
  };
  requested.length = 0;
  const markup = html(Payouts, {});
  assert.equal((markup.match(/Record payment/g) || []).length, 2, "pending and processing rows");
  assert.equal((markup.match(/Update status/g) || []).length, 2, "not the completed row");
  assert.equal((markup.match(/View details/g) || []).length, 3);
  assert.ok(markup.includes("$42.50"));
  assert.ok(markup.includes(settlementStatusLabel("completed")));
  assert.deepEqual(requested, []);
  listState = { ...listState, payouts: [] };
  assert.match(html(Payouts, {}), /No payouts/);
});
