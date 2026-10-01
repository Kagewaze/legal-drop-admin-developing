// Generic admin "Cancel Order" (backend Wave 2D, 5ca8cae):
//   POST admin/orders/:orderId/cancel          { reason } -> the order's cancellation view
//   GET  admin/orders/:orderId/cancellation    -> the same view
// The backend is the only authority on eligibility, refunds, races and finalization. This module only
// decides when the button is obviously pointless, validates the reason the way the backend counts it,
// and turns the backend's answer into wording that never claims more than the backend said. It never
// reads or returns provider identifiers, admin ids or order metadata.

export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 500;
export const RESULT_UNKNOWN_MESSAGE = "Result unknown — refresh the order before retrying.";

export const cancellationRequestUrl = (orderId) => `admin/orders/${orderId}/cancel`;
export const cancellationStateUrl = (orderId) => `admin/orders/${orderId}/cancellation`;

/**
 * Obvious UI eligibility only: a genuinely pending order nobody has committed to, with no
 * cancellation recorded. Anything missing or unexpected hides the button; the backend re-checks all
 * of it (and more) under the order lock.
 */
export function canCancelOrder(order) {
  if (!order || typeof order !== "object" || !order.id) return false;
  return (
    order.status === "pending" &&
    order.driverUserId == null &&
    order.isAccepted === false &&
    !order.packagePickedUp &&
    order.completedAt == null &&
    order.cancellationStatus == null
  );
}

/** Only an order with a cancellation has state to show (the GET is not needed otherwise). */
export const shouldLoadCancellationState = (order) => Boolean(order?.id) && order.cancellationStatus != null;

export const confirmButtonLabel = (order) => (order?.paid === true ? "Cancel Order & Refund" : "Cancel Order");

const PAYMENT_METHODS = { card: "Card", customer_link: "Customer payment link", cash: "Cash", transfer: "Transfer" };
const PRICING_MODES = { standard: "Standard", dropbatch: "DropBatch" };
const humanize = (value) => {
  const text = String(value ?? "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** What the confirmation shows about the order. */
export function orderCancellationSummary(order) {
  const paid = order?.paid === true;
  const method = PAYMENT_METHODS[order?.paymentMethod] ?? humanize(order?.paymentMethod);
  const category = humanize(order?.orderCategory) || "Order";
  const mode = PRICING_MODES[order?.pricingMode] ?? humanize(order?.pricingMode);
  return {
    trackingCode: order?.trackingCode || "—",
    payment: [paid ? "Paid" : "Unpaid", method].filter(Boolean).join(" · "),
    service: [category, mode].filter(Boolean).join(" · "),
    warning: paid
      ? "Druppr will attempt to refund this paid order through its original payment method. If it cannot be refunded automatically, the order will not be finalized as cancelled and will require manual review."
      : "This order is unpaid. If the backend accepts the cancellation, it is cancelled with no refund.",
  };
}

/**
 * Validates the reason as the backend counts it: the request validator counts characters (an emoji
 * is one) for the minimum, and the service counts UTF-16 units (an emoji is two) for the maximum.
 * The counter shows the service's count, the binding one for the maximum.
 */
export function validateCancellationReason(raw) {
  const trimmed = String(raw ?? "").trim();
  const count = trimmed.length;
  const characters = Array.from(trimmed).filter((ch) => ch !== "︎" && ch !== "️").length;
  let error = null;
  if (characters < CANCEL_REASON_MIN) error = `Enter a reason of at least ${CANCEL_REASON_MIN} characters.`;
  else if (count > CANCEL_REASON_MAX) error = `The reason can be at most ${CANCEL_REASON_MAX} characters.`;
  return { ok: error === null, trimmed, count, error };
}

const OUTCOMES = {
  cancelled_refunded: {
    tone: "success",
    title: "Cancelled & refunded",
    detail: "The order is cancelled and the customer's payment was refunded in full.",
  },
  cancelled_no_refund: {
    tone: "success",
    title: "Cancelled — nothing to refund",
    detail: "The order was unpaid, so it was cancelled with no refund.",
  },
  refund_pending: {
    tone: "info",
    title: "Refund processing",
    detail: "The order is frozen while the refund settles and becomes cancelled once it succeeds. Do not cancel again.",
  },
  refund_succeeded_finalizing: {
    tone: "info",
    title: "Refund processing",
    detail: "The refund succeeded and the cancellation is being finalized. Do not cancel again.",
  },
  needs_review: {
    tone: "warning",
    title: "Needs review — do not retry",
    detail: "The cancellation is held for manual review. Do not submit it again.",
  },
};

const unknownResult = (detail = "The outcome could not be confirmed.") => ({
  state: "unknown",
  tone: "warning",
  title: RESULT_UNKNOWN_MESSAGE,
  detail,
});

/** A backend cancellation view -> what happened. HTTP 200 alone never means "refunded". */
export function classifyCancellationOutcome(view) {
  const known = view && typeof view === "object" ? OUTCOMES[view.outcome] : undefined;
  if (!known) return unknownResult();
  const reviewReason = view.outcome === "needs_review" ? view.refund?.needsReviewReason : null;
  return {
    state: "outcome",
    outcome: view.outcome,
    ...known,
    detail: reviewReason ? `${known.detail} Review reason: ${reviewReason}.` : known.detail,
  };
}

const REFUSALS = {
  DRIVER_COMMITTED: {
    title: "Cannot cancel — a driver has already committed to this order",
    detail: "Nothing was cancelled.",
  },
  PICKUP_STARTED: { title: "Cannot cancel — pickup has already started", detail: "Nothing was cancelled." },
  ORDER_NOT_PENDING: { title: "This order is no longer cancellable", detail: "Nothing was cancelled." },
  MANUAL_REFUND_REQUIRED: {
    title: "Manual refund required — order was not automatically cancelled",
    detail: "This payment cannot be refunded automatically. Handle the refund manually; cancelling again here will not refund it.",
  },
  GROUPED_ORDER_UNSUPPORTED: {
    title: "Cannot cancel — this order is part of a group paid together",
    detail: "Nothing was cancelled. Grouped orders cannot be cancelled individually yet.",
  },
  CANCELLATION_IN_PROGRESS: {
    title: "A cancellation is already in progress",
    detail: "Refresh the order to see its current cancellation state.",
  },
  PAYMENT_COMPLETED_REFRESH: {
    title: "A payment just completed — nothing was cancelled",
    detail: "Refresh the order before deciding what to do.",
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    title: "The payment provider could not be reached — nothing was cancelled",
    detail: "Refresh the order before trying again later.",
  },
};

/**
 * A failed request -> what is known. Only an answer the backend gave about this request is a
 * refusal; a network failure, a crash in the HTTP client, a 5xx or anything unrecognised may have
 * happened after the cancellation started, so it is "result unknown".
 */
export function classifyCancellationError(error) {
  const response = error?.response;
  if (!response || typeof response.status !== "number") return unknownResult();
  const { status } = response;
  const body = response.data && typeof response.data === "object" ? response.data : {};
  const code = body.details?.code;
  const message = typeof body.message === "string" && body.message ? body.message : null;
  if (code && REFUSALS[code]) return { state: "refused", tone: "error", code, ...REFUSALS[code] };
  if (status === 400) return { state: "refused", tone: "error", title: "Not cancelled", detail: message ?? "The request was rejected." };
  if (status === 401 || status === 403) {
    return { state: "refused", tone: "error", title: "Not authorized — nothing was cancelled", detail: message ?? "Sign in again as an admin." };
  }
  if (status === 404) return { state: "refused", tone: "error", title: "Order not found — nothing was cancelled", detail: message ?? "" };
  return unknownResult();
}

const viewFrom = (response) => response?.data?.data;

/**
 * One confirmation, one POST. The first valid call sends the request; every later call (a double
 * click, a repeat confirmation) gets the same answer and sends nothing. An invalid reason sends
 * nothing and does not use the submission up. After any response `onSettled` runs (the page refetches
 * the order).
 */
export function createCancellationSubmitter({ client, orderId, onSettled }) {
  let pending = null;
  return function submit(rawReason) {
    if (pending) return pending;
    if (!orderId) return Promise.resolve(unknownResult("This order could not be identified."));
    const reason = validateCancellationReason(rawReason);
    if (!reason.ok) return Promise.resolve({ state: "invalid", tone: "error", title: reason.error, detail: "" });
    pending = (async () => {
      let result;
      try {
        const response = await client.post(cancellationRequestUrl(orderId), { reason: reason.trimmed });
        result = classifyCancellationOutcome(viewFrom(response));
      } catch (error) {
        result = classifyCancellationError(error);
      }
      try {
        await onSettled?.();
      } catch {
        // A failed refetch must not hide what the cancellation request returned.
      }
      return result;
    })();
    return pending;
  };
}

const money = (amountMinor, currency) =>
  Number.isFinite(amountMinor) ? `${(amountMinor / 100).toFixed(2)} ${currency || ""}`.trim() : "Unavailable";

/** The order's current cancellation state, reduced to what an admin may see. Never throws. */
export async function loadCancellationState(client, orderId) {
  try {
    const view = viewFrom(await client.get(cancellationStateUrl(orderId)));
    const classified = classifyCancellationOutcome(view);
    if (classified.state !== "outcome") return classified;
    return {
      ...classified,
      state: "loaded",
      refundAmount: view.refund ? money(view.refund.amountMinor, view.refund.currency) : null,
      providerRefundStatus: view.refund?.providerRefundStatus ?? null,
      requestedAt: view.requestedAt ?? null,
      finalizedAt: view.finalizedAt ?? null,
    };
  } catch (error) {
    const failure = classifyCancellationError(error);
    return failure.state === "unknown"
      ? unknownResult("The cancellation state could not be loaded.")
      : { ...failure, state: "unknown", tone: "warning" };
  }
}
