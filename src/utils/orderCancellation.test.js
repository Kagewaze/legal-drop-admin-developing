/* eslint-env node */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

import * as helpers from "./orderCancellation.js";

const {
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  RESULT_UNKNOWN_MESSAGE,
  canCancelOrder,
  cancellationRequestUrl,
  cancellationStateUrl,
  classifyCancellationError,
  classifyCancellationOutcome,
  confirmButtonLabel,
  createCancellationSubmitter,
  loadCancellationState,
  orderCancellationSummary,
  shouldLoadCancellationState,
  validateCancellationReason,
} = helpers;

// Synthetic fixtures shaped like backend 5ca8cae: the admin `admin/orders` row and the generic
// OrderCancellationView. Every request goes to an in-memory fake client; nothing reaches a server.
const ORDER_ID = "0b8a5d8e-4f0e-4c1f-9a51-2f1d7b1c9e01";
const ADMIN_UUID = "99999999-9999-4999-8999-999999999999";
const HIDDEN = ["pi_hidden_fixture", "cs_hidden_fixture", "re_hidden_fixture", ADMIN_UUID, "cancellationRequest", "internal note"];
const order = (over = {}) => ({
  id: ORDER_ID,
  trackingCode: "TRK-FIXTURE",
  status: "pending",
  paid: true,
  paymentMethod: "card",
  orderCategory: "delivery",
  pricingMode: "standard",
  isAccepted: false,
  driverUserId: null,
  onRouteToPickup: null,
  packagePickedUp: null,
  completedAt: null,
  cancellationStatus: null,
  // Internal data an admin row carries; none of it may ever be rendered.
  metadata: {
    paymentIntentId: "pi_hidden_fixture",
    checkoutSessionId: "cs_hidden_fixture",
    cancellationRequest: { reason: `[support-cancel admin=${ADMIN_UUID}] internal note`, requestedBy: "support" },
  },
  ...over,
});
const view = (over = {}) => ({
  orderId: ORDER_ID,
  trackingCode: "TRK-FIXTURE",
  orderStatus: "pending",
  paid: true,
  paymentMethod: "card",
  orderCategory: "delivery",
  pricingMode: "standard",
  cancellationStatus: "pending",
  outcome: "refund_pending",
  refund: {
    authority: "order_refund_recovery",
    amountMinor: 2150,
    currency: "CAD",
    providerRefundStatus: "pending",
    needsReviewReason: null,
    updatedAt: "2026-10-01T12:00:00.000Z",
    // Defensive: even if a provider id ever appeared here, it must not be rendered.
    providerRefundId: "re_hidden_fixture",
  },
  requestedAt: "2026-10-01T12:00:00.000Z",
  finalizedAt: null,
  ...over,
});
const httpError = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
const refusal = (status, code, message = "backend message") =>
  httpError(status, { success: false, statusCode: status, message, ...(code ? { details: { code } } : {}) });
// What this app's axios interceptor actually throws for a network failure (it destructures error.response).
const interceptorCrash = () => new TypeError("Cannot destructure property 'status' of 'error?.response' as it is undefined.");
const fakeClient = ({ post, get } = {}) => {
  const calls = { post: [], get: [] };
  return {
    calls,
    post: async (url, body) => {
      calls.post.push({ url, body });
      return post ? post(url, body) : { status: 200, data: { success: true, data: view() } };
    },
    get: async (url) => {
      calls.get.push(url);
      return get ? get(url) : { status: 200, data: { success: true, data: view() } };
    },
  };
};
const leaksNothing = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const hidden of HIDDEN) assert.ok(!text.includes(hidden), `must not expose ${hidden}`);
};

// ── Visibility: obvious eligibility only; the backend stays the authority ──

test("an eligible pending order (no driver, not accepted, not picked up or completed, no cancellation) shows Cancel Order", () => {
  assert.equal(canCancelOrder(order()), true);
  assert.equal(canCancelOrder(order({ paid: false, paymentMethod: "customer_link" })), true);
  assert.equal(canCancelOrder(order({ orderCategory: "marketplace_delivery" })), true);
  assert.equal(canCancelOrder(order({ pricingMode: "dropbatch" })), true);
});

for (const [label, over] of [
  ["an assigned order", { status: "assigned", driverUserId: "driver-1" }],
  ["a pending order with a driver set", { driverUserId: "driver-1" }],
  ["an accepted order", { isAccepted: true }],
  ["an ongoing order", { status: "ongoing", isAccepted: true, driverUserId: "driver-1" }],
  ["a picked-up order", { packagePickedUp: "2026-10-01T10:00:00.000Z" }],
  ["a completed order", { status: "delivered", completedAt: "2026-10-01T11:00:00.000Z" }],
  ["an order with a cancellation in progress", { cancellationStatus: "pending" }],
  ["an order under cancellation review", { cancellationStatus: "needs_review" }],
  ["an order whose cancellation is final", { status: "cancelled", cancellationStatus: "finalized" }],
  ["a cancelled order", { status: "cancelled" }],
]) {
  test(`${label} cannot be cancelled from the UI`, () => {
    assert.equal(canCancelOrder(order(over)), false);
  });
}

test("a missing, still-loading or partial order is hidden and never throws", () => {
  assert.equal(canCancelOrder(null), false);
  assert.equal(canCancelOrder(undefined), false);
  assert.equal(canCancelOrder({ id: "", status: "" }), false);
  assert.equal(canCancelOrder(order({ isAccepted: undefined })), false);
});

test("cancellation state is requested only for an order that has a cancellation", () => {
  assert.equal(shouldLoadCancellationState(order()), false);
  assert.equal(shouldLoadCancellationState(order({ cancellationStatus: "pending" })), true);
  assert.equal(shouldLoadCancellationState(order({ cancellationStatus: "finalized" })), true);
  assert.equal(shouldLoadCancellationState(null), false);
});

// ── Confirmation contents ──

test("a paid order confirms with Cancel Order & Refund; an unpaid one with Cancel Order", () => {
  assert.equal(confirmButtonLabel(order({ paid: true })), "Cancel Order & Refund");
  assert.equal(confirmButtonLabel(order({ paid: false })), "Cancel Order");
});

test("the confirmation names tracking code, payment status, order type and the refund consequence", () => {
  const paid = orderCancellationSummary(order());
  assert.equal(paid.trackingCode, "TRK-FIXTURE");
  assert.equal(paid.payment, "Paid · Card");
  assert.equal(paid.service, "Delivery · Standard");
  assert.match(paid.warning, /refund/i);
  const unpaid = orderCancellationSummary(order({ paid: false, paymentMethod: "customer_link", orderCategory: "marketplace_delivery", pricingMode: "dropbatch" }));
  assert.equal(unpaid.payment, "Unpaid · Customer payment link");
  assert.equal(unpaid.service, "Marketplace delivery · DropBatch");
  assert.match(unpaid.warning, /no refund/i);
  leaksNothing(paid);
});

// ── Reason ──

test("the reason is trimmed, required, 3 to 500 characters, with a counter", () => {
  assert.deepEqual(validateCancellationReason("  customer asked  "), { ok: true, trimmed: "customer asked", count: 14, error: null });
  assert.equal(CANCEL_REASON_MIN, 3);
  assert.equal(CANCEL_REASON_MAX, 500);
  for (const short of ["", "   ", "ab", "  ab  "]) assert.equal(validateCancellationReason(short).ok, false);
  assert.equal(validateCancellationReason("abc").ok, true);
  assert.equal(validateCancellationReason("x".repeat(500)).ok, true);
  const long = validateCancellationReason("x".repeat(501));
  assert.equal(long.ok, false);
  assert.equal(long.count, 501);
  assert.match(long.error, /500/);
  assert.match(validateCancellationReason("a").error, /3/);
});

test("the reason limits match the backend's own counts (emoji are 1 for the minimum, 2 for the maximum)", () => {
  assert.equal(validateCancellationReason("a😀").ok, false); // 2 characters for the request validator
  assert.equal(validateCancellationReason("😀".repeat(250)).ok, true); // 500 code units for the service
  assert.equal(validateCancellationReason("😀".repeat(251)).ok, false);
});

// ── Outcomes: HTTP 200 alone is never "refund complete" ──

test("cancelled_refunded (finalized) is Cancelled & refunded", () => {
  const r = classifyCancellationOutcome(view({ cancellationStatus: "finalized", outcome: "cancelled_refunded", orderStatus: "cancelled" }));
  assert.equal(r.title, "Cancelled & refunded");
  assert.equal(r.tone, "success");
});

test("an unpaid order cancelled with nothing to refund is reported as such", () => {
  const r = classifyCancellationOutcome(view({ paid: false, cancellationStatus: "finalized", outcome: "cancelled_no_refund", refund: null }));
  assert.equal(r.title, "Cancelled — nothing to refund");
  assert.equal(r.tone, "success");
});

test("refund_pending is Refund processing, not success", () => {
  const r = classifyCancellationOutcome(view());
  assert.equal(r.title, "Refund processing");
  assert.notEqual(r.tone, "success");
  assert.match(r.detail, /do not cancel again/i);
  const finalizing = classifyCancellationOutcome(view({ outcome: "refund_succeeded_finalizing" }));
  assert.equal(finalizing.title, "Refund processing");
  assert.notEqual(finalizing.tone, "success");
});

test("needs_review says do not retry and shows the backend's review reason", () => {
  const r = classifyCancellationOutcome(
    view({ cancellationStatus: "needs_review", outcome: "needs_review", refund: { ...view().refund, needsReviewReason: "marketplace_refund_failed" } })
  );
  assert.equal(r.title, "Needs review — do not retry");
  assert.equal(r.tone, "warning");
  assert.match(r.detail, /marketplace_refund_failed/);
});

test("an unknown or malformed outcome is never success", () => {
  for (const bad of [null, undefined, {}, view({ outcome: "none" }), view({ outcome: "refunded_maybe" }), "ok"]) {
    const r = classifyCancellationOutcome(bad);
    assert.equal(r.title, RESULT_UNKNOWN_MESSAGE);
    assert.notEqual(r.tone, "success");
  }
  assert.equal(RESULT_UNKNOWN_MESSAGE, "Result unknown — refresh the order before retrying.");
});

// ── Refusals and failures ──

test("DRIVER_COMMITTED, PICKUP_STARTED and ORDER_NOT_PENDING are definitive refusals", () => {
  assert.equal(classifyCancellationError(refusal(409, "DRIVER_COMMITTED")).title, "Cannot cancel — a driver has already committed to this order");
  assert.equal(classifyCancellationError(refusal(409, "PICKUP_STARTED")).title, "Cannot cancel — pickup has already started");
  assert.equal(classifyCancellationError(refusal(409, "ORDER_NOT_PENDING")).title, "This order is no longer cancellable");
  for (const code of ["DRIVER_COMMITTED", "PICKUP_STARTED", "ORDER_NOT_PENDING"]) {
    const r = classifyCancellationError(refusal(409, code));
    assert.equal(r.state, "refused");
    assert.equal(r.code, code);
  }
});

test("MANUAL_REFUND_REQUIRED says the order was not automatically cancelled", () => {
  const r = classifyCancellationError(refusal(422, "MANUAL_REFUND_REQUIRED"));
  assert.equal(r.title, "Manual refund required — order was not automatically cancelled");
  assert.equal(r.state, "refused");
});

test("the remaining backend codes are explained without inviting a blind retry", () => {
  assert.match(classifyCancellationError(refusal(422, "GROUPED_ORDER_UNSUPPORTED")).title, /group/i);
  assert.match(classifyCancellationError(refusal(409, "CANCELLATION_IN_PROGRESS")).title, /already in progress/i);
  assert.match(classifyCancellationError(refusal(409, "PAYMENT_COMPLETED_REFRESH")).title, /payment just completed/i);
  assert.match(classifyCancellationError(refusal(503, "PAYMENT_PROVIDER_UNAVAILABLE")).title, /payment provider/i);
  const validation = classifyCancellationError(refusal(400, null, "A cancellation reason of 3 to 500 characters is required"));
  assert.equal(validation.state, "refused");
  assert.match(validation.detail, /3 to 500/);
  assert.equal(classifyCancellationError(refusal(404, null, "Order not found")).state, "refused");
  assert.equal(classifyCancellationError(refusal(403, null, "Forbidden")).state, "refused");
});

test("a network failure, interceptor crash, 5xx or anything unrecognised is result unknown", () => {
  for (const failure of [interceptorCrash(), new Error("Network Error"), refusal(500, null), refusal(502, null), httpError(418, "teapot"), null, undefined]) {
    const r = classifyCancellationError(failure);
    assert.equal(r.state, "unknown");
    assert.equal(r.title, RESULT_UNKNOWN_MESSAGE);
    assert.doesNotMatch(r.title + r.detail, /try again now|retry now/i);
  }
});

// ── Submission: one generic endpoint, one POST, refetch after every response ──

test("confirming posts once to POST admin/orders/:orderId/cancel with only the trimmed reason", async () => {
  const client = fakeClient();
  const settled = [];
  const submit = createCancellationSubmitter({ client, orderId: ORDER_ID, onSettled: () => settled.push("refetch") });
  const r = await submit("  customer asked support  ");
  assert.deepEqual(client.calls.post, [{ url: `admin/orders/${ORDER_ID}/cancel`, body: { reason: "customer asked support" } }]);
  assert.equal(cancellationRequestUrl(ORDER_ID), `admin/orders/${ORDER_ID}/cancel`);
  assert.equal(r.title, "Refund processing");
  assert.deepEqual(settled, ["refetch"]);
  assert.ok(!client.calls.post[0].url.includes("dropbatch"));
});

test("double clicks and repeat confirmations never send a second POST", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const client = fakeClient({ post: async () => (await gate, { status: 200, data: { success: true, data: view() } }) });
  const submit = createCancellationSubmitter({ client, orderId: ORDER_ID, onSettled: () => {} });
  const first = submit("customer asked");
  const second = submit("customer asked");
  release();
  const [a, b] = await Promise.all([first, second]);
  await submit("customer asked");
  assert.equal(client.calls.post.length, 1);
  assert.equal(a, b);
});

test("an invalid reason sends nothing and leaves the confirmation usable", async () => {
  const client = fakeClient();
  const submit = createCancellationSubmitter({ client, orderId: ORDER_ID, onSettled: () => assert.fail("nothing was sent") });
  const r = await submit("  a ");
  assert.equal(r.state, "invalid");
  assert.equal(client.calls.post.length, 0);
  await submit("customer asked");
  assert.equal(client.calls.post.length, 1);
});

test("the order is refetched after a success, a refusal and an unknown failure alike", async () => {
  for (const post of [
    async () => ({ status: 200, data: { success: true, data: view({ outcome: "cancelled_refunded", cancellationStatus: "finalized" }) } }),
    async () => Promise.reject(refusal(409, "DRIVER_COMMITTED")),
    async () => Promise.reject(refusal(422, "MANUAL_REFUND_REQUIRED")),
    async () => Promise.reject(interceptorCrash()),
  ]) {
    const settled = [];
    const submit = createCancellationSubmitter({ client: fakeClient({ post }), orderId: ORDER_ID, onSettled: () => settled.push("refetch") });
    await submit("customer asked");
    assert.deepEqual(settled, ["refetch"]);
  }
});

test("each response is reported as the backend decided it", async () => {
  const run = (post) => createCancellationSubmitter({ client: fakeClient({ post }), orderId: ORDER_ID, onSettled: () => {} })("customer asked");
  assert.equal((await run(async () => ({ status: 200, data: { data: view({ outcome: "cancelled_refunded" }) } }))).title, "Cancelled & refunded");
  assert.equal((await run(async () => ({ status: 200, data: { data: view({ outcome: "needs_review" }) } }))).title, "Needs review — do not retry");
  assert.equal((await run(async () => Promise.reject(refusal(409, "DRIVER_COMMITTED")))).title, "Cannot cancel — a driver has already committed to this order");
  assert.equal((await run(async () => Promise.reject(refusal(422, "MANUAL_REFUND_REQUIRED")))).title, "Manual refund required — order was not automatically cancelled");
  assert.equal((await run(async () => Promise.reject(interceptorCrash()))).title, RESULT_UNKNOWN_MESSAGE);
  // A 200 whose body is not a cancellation view is not success.
  assert.equal((await run(async () => ({ status: 200, data: { data: null } }))).title, RESULT_UNKNOWN_MESSAGE);
});

test("a submitter without an order id sends nothing", async () => {
  const client = fakeClient();
  const r = await createCancellationSubmitter({ client, orderId: "", onSettled: () => {} })("customer asked");
  assert.equal(r.state, "unknown");
  assert.equal(client.calls.post.length, 0);
});

// ── Current cancellation state (GET admin/orders/:orderId/cancellation) ──

test("an order's cancellation state is loaded from the generic endpoint and classified", async () => {
  const client = fakeClient({ get: async () => ({ status: 200, data: { data: view({ outcome: "refund_pending" }) } }) });
  const state = await loadCancellationState(client, ORDER_ID);
  assert.deepEqual(client.calls.get, [`admin/orders/${ORDER_ID}/cancellation`]);
  assert.equal(cancellationStateUrl(ORDER_ID), `admin/orders/${ORDER_ID}/cancellation`);
  assert.equal(state.title, "Refund processing");
  assert.equal(state.refundAmount, "21.50 CAD");
  assert.equal(state.providerRefundStatus, "pending");
  leaksNothing(state);
});

test("a failed state lookup is reported as unknown, never as success", async () => {
  const state = await loadCancellationState(fakeClient({ get: async () => Promise.reject(interceptorCrash()) }), ORDER_ID);
  assert.equal(state.state, "unknown");
  assert.notEqual(state.tone, "success");
});

test("a missing refund amount shows as unavailable, never as zero", async () => {
  const state = await loadCancellationState(
    fakeClient({ get: async () => ({ status: 200, data: { data: view({ refund: { ...view().refund, amountMinor: null } }) } }) }),
    ORDER_ID
  );
  assert.equal(state.refundAmount, "Unavailable");
});

// ── Components: rendered markup for the admin order page ──

const require = createRequire(import.meta.url);
const componentSource = readFileSync(new URL("../components/orders/orderCancellation.jsx", import.meta.url), "utf8");
const { code: componentCode } = await transformWithEsbuild(componentSource, "orderCancellation.jsx", {
  loader: "jsx",
  format: "cjs",
  jsx: "automatic",
});
const component = { exports: {} };
new Function("require", "module", "exports", componentCode)(
  (name) => {
    if (name === "../../utils/customFetch") {
      return { default: { get: () => assert.fail("render must not request"), post: () => assert.fail("render must not request") } };
    }
    if (name === "../../utils/orderCancellation") return helpers;
    if (name === "../../utils/dateTime") return { getFormattedDateTime: (value) => `at ${value}` };
    return require(name);
  },
  component,
  component.exports
);
const { CancelOrderModal, CancellationStatePanel, OrderCancellation } = component.exports;
const html = (element) => renderToStaticMarkup(element);
const noop = () => {};
function buttons(node, found = []) {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    node.forEach((child) => buttons(child, found));
    return found;
  }
  if (node.type === "button") found.push(node);
  if (typeof node.type === "function") return buttons(node.type(node.props), found);
  buttons(node.props?.children, found);
  return found;
}
const textOf = (node) =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : node?.props
        ? textOf(node.props.children)
        : "";
const modal = (props = {}) =>
  CancelOrderModal({ order: order(), reason: "", submitting: false, result: null, onReasonChange: noop, onSubmit: noop, onClose: noop, ...props });
const button = (tree, label) => buttons(tree).find((node) => textOf(node) === label);
const page = (o) => html(React.createElement(OrderCancellation, { order: o, onOrderChanged: noop }));

test("the order page shows Cancel Order for an eligible order", () => {
  assert.match(page(order()), />Cancel Order</);
  assert.match(page(order({ paid: false })), />Cancel Order</);
});

for (const [label, over] of [
  ["assigned", { status: "assigned", driverUserId: "driver-1" }],
  ["accepted", { isAccepted: true }],
  ["ongoing", { status: "ongoing", isAccepted: true, driverUserId: "driver-1" }],
  ["picked-up", { packagePickedUp: "2026-10-01T10:00:00.000Z" }],
  ["completed", { status: "delivered", completedAt: "2026-10-01T11:00:00.000Z" }],
]) {
  test(`the order page shows no cancellation action for a ${label} order`, () => {
    assert.doesNotMatch(page(order(over)), /Cancel Order/);
  });
}

test("an order with an existing cancellation shows its state, not a fresh Cancel Order", () => {
  const markup = page(order({ cancellationStatus: "pending" }));
  assert.doesNotMatch(markup, />Cancel Order</);
  assert.match(markup, /Cancellation/);
});

test("the paid confirmation says Cancel Order & Refund; the unpaid one says Cancel Order", () => {
  assert.ok(button(modal({ order: order({ paid: true }), reason: "customer asked" }), "Cancel Order & Refund"));
  assert.ok(button(modal({ order: order({ paid: false }), reason: "customer asked" }), "Cancel Order"));
  assert.equal(button(modal({ order: order({ paid: false }), reason: "customer asked" }), "Cancel Order & Refund"), undefined);
});

test("the confirmation shows tracking code, payment status, order type, the refund warning and a counter", () => {
  const markup = html(modal({ reason: "customer asked" }));
  assert.match(markup, /TRK-FIXTURE/);
  assert.match(markup, /Paid · Card/);
  assert.match(markup, /Delivery · Standard/);
  assert.match(markup, /refund/i);
  assert.match(markup, /14\s*\/\s*500/);
  leaksNothing(markup);
});

test("the confirm button stays disabled until the trimmed reason is valid", () => {
  assert.equal(button(modal({ reason: "  ab " }), "Cancel Order & Refund").props.disabled, true);
  assert.equal(button(modal({ reason: "x".repeat(501) }), "Cancel Order & Refund").props.disabled, true);
  assert.equal(button(modal({ reason: "customer asked" }), "Cancel Order & Refund").props.disabled, false);
});

test("while the request is in flight nothing can resubmit or dismiss the modal", () => {
  const tree = modal({ reason: "customer asked", submitting: true });
  assert.equal(button(tree, "Cancelling…").props.disabled, true);
  assert.equal(button(tree, "Close").props.disabled, true);
  assert.equal(button(tree, "Cancel Order & Refund"), undefined);
});

for (const [label, result, expected] of [
  ["refund_pending", classifyCancellationOutcome(view()), "Refund processing"],
  ["finalized / refunded", classifyCancellationOutcome(view({ outcome: "cancelled_refunded", cancellationStatus: "finalized" })), "Cancelled &amp; refunded"],
  ["needs_review", classifyCancellationOutcome(view({ outcome: "needs_review" })), "Needs review — do not retry"],
  ["DRIVER_COMMITTED", classifyCancellationError(refusal(409, "DRIVER_COMMITTED")), "Cannot cancel — a driver has already committed to this order"],
  ["MANUAL_REFUND_REQUIRED", classifyCancellationError(refusal(422, "MANUAL_REFUND_REQUIRED")), "Manual refund required — order was not automatically cancelled"],
  ["an unknown failure", classifyCancellationError(interceptorCrash()), "Result unknown — refresh the order before retrying."],
]) {
  test(`after a ${label} response the modal shows it and offers no resubmit`, () => {
    const tree = modal({ reason: "customer asked", result });
    const markup = html(tree);
    assert.ok(markup.includes(expected), `expected "${expected}"`);
    assert.equal(button(tree, "Cancel Order & Refund"), undefined);
    assert.equal(button(tree, "Cancel Order"), undefined);
    assert.equal(button(tree, "Close").props.disabled, false);
    leaksNothing(markup);
  });
}

test("the order page mounts the control with its own order refetch, and nothing calls the old DropBatch cancel endpoint", () => {
  const pageSource = readFileSync(new URL("../components/orders/singleOrder.jsx", import.meta.url), "utf8");
  assert.match(pageSource, /<OrderCancellation order=\{order\} onOrderChanged=\{fetchSingleOrder\} \/>/);
  for (const source of [pageSource, componentSource, readFileSync(new URL("./orderCancellation.js", import.meta.url), "utf8")]) {
    assert.doesNotMatch(source, /dropbatch-cancellations|dropbatch-cancel\b/i);
    assert.doesNotMatch(source, /stripe/i);
  }
});

test("the cancellation state panel renders refund_pending, finalized and needs_review without internal data", () => {
  const pending = html(React.createElement(CancellationStatePanel, { state: { state: "loaded", ...classifyCancellationOutcome(view()), refundAmount: "21.50 CAD", providerRefundStatus: "pending", requestedAt: view().requestedAt, finalizedAt: null } }));
  assert.match(pending, /Refund processing/);
  assert.match(pending, /21\.50 CAD/);
  const final = html(React.createElement(CancellationStatePanel, { state: { state: "loaded", ...classifyCancellationOutcome(view({ outcome: "cancelled_refunded" })) } }));
  assert.match(final, /Cancelled &amp; refunded/);
  const review = html(React.createElement(CancellationStatePanel, { state: { state: "loaded", ...classifyCancellationOutcome(view({ outcome: "needs_review" })) } }));
  assert.match(review, /Needs review — do not retry/);
  assert.match(html(React.createElement(CancellationStatePanel, { state: { state: "loading" } })), /Loading/);
  for (const markup of [pending, final, review]) leaksNothing(markup);
});
