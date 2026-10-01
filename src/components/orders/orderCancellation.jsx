/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useEffect, useRef, useState } from "react";
import customFetch from "../../utils/customFetch";
import { getFormattedDateTime } from "../../utils/dateTime";
import {
  CANCEL_REASON_MAX,
  canCancelOrder,
  confirmButtonLabel,
  createCancellationSubmitter,
  loadCancellationState,
  orderCancellationSummary,
  shouldLoadCancellationState,
  validateCancellationReason,
} from "../../utils/orderCancellation";

const TONES = {
  success: "border-green-300 bg-green-50 text-green-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  error: "border-red-300 bg-red-50 text-red-800",
};

/** A classified result: { tone, title, detail }. */
function ResultNotice({ result }) {
  return (
    <div role="status" className={`rounded-md border p-3 text-sm ${TONES[result.tone] ?? TONES.warning}`}>
      <p className="font-semibold">{result.title}</p>
      {result.detail ? <p className="mt-1">{result.detail}</p> : null}
    </div>
  );
}

/**
 * The confirmation. Pure: the page owns the state.
 * Props: order, reason, submitting, result (null until the backend answered), onReasonChange(text),
 * onSubmit(), onClose().
 */
export function CancelOrderModal({ order, reason, submitting, result, onReasonChange, onSubmit, onClose }) {
  const summary = orderCancellationSummary(order);
  const validation = validateCancellationReason(reason);
  const answered = Boolean(result);
  return (
    <section className="modalBG" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
      <div className="longModalContainer border-4">
        <div className="px-4">
          <p id="cancel-order-title" className="text-lg font-semibold text-gray900">
            Cancel Order
          </p>
          <p className="text-sm text-gray600">The backend decides whether this order can be cancelled and any refund.</p>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-gray200 px-4 pt-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-gray500">Tracking code</dt>
            <dd className="font-medium text-gray900">{summary.trackingCode}</dd>
          </div>
          <div>
            <dt className="text-gray500">Payment</dt>
            <dd className="font-medium text-gray900">{summary.payment}</dd>
          </div>
          <div>
            <dt className="text-gray500">Order type</dt>
            <dd className="font-medium text-gray900">{summary.service}</dd>
          </div>
        </dl>

        <p className="mx-4 mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          {summary.warning}
        </p>

        <div className="mt-4 px-4">
          {answered ? (
            <ResultNotice result={result} />
          ) : (
            <>
              <label htmlFor="cancel-order-reason" className="mb-1 block text-sm font-medium text-gray500">
                Cancellation reason (required)
              </label>
              <textarea
                id="cancel-order-reason"
                rows={4}
                value={reason}
                disabled={submitting}
                onChange={(event) => onReasonChange(event.target.value)}
                className="w-full rounded-md border border-gray200 p-2 text-sm"
              />
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-red-700">{reason && !validation.ok ? validation.error : ""}</span>
                <span className="text-gray500">
                  {validation.count} / {CANCEL_REASON_MAX}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3 border-t border-gray200 px-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          >
            Close
          </button>
          {answered ? null : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !validation.ok}
              className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Cancelling…" : confirmButtonLabel(order)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The order's current cancellation state (from GET …/cancellation). Props: state. */
export function CancellationStatePanel({ state }) {
  if (!state) return null;
  return (
    <section className="mb-10 rounded-md border bg-gray50 p-2 py-4 shadow-md" aria-live="polite">
      <h2 className="mb-4 text-lg font-semibold text-black">Cancellation</h2>
      {state.state === "loading" ? (
        <p className="pl-4 text-sm">Loading cancellation state…</p>
      ) : (
        <div className="pl-4">
          <ResultNotice result={state} />
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {state.refundAmount ? (
              <p>
                <strong>Refund amount:</strong> {state.refundAmount}
              </p>
            ) : null}
            {state.providerRefundStatus ? (
              <p>
                <strong>Refund status:</strong> {state.providerRefundStatus}
              </p>
            ) : null}
            {state.requestedAt ? (
              <p>
                <strong>Requested:</strong> {getFormattedDateTime(state.requestedAt)}
              </p>
            ) : null}
            {state.finalizedAt ? (
              <p>
                <strong>Finalized:</strong> {getFormattedDateTime(state.finalizedAt)}
              </p>
            ) : null}
          </dl>
        </div>
      )}
    </section>
  );
}

/**
 * The general admin "Cancel Order" control for the order page. Props: order (the admin order row),
 * onOrderChanged() (refetches the order), client (defaults to the app's HTTP client).
 */
export const OrderCancellation = ({ order, onOrderChanged, client = customFetch }) => {
  const orderId = order?.id;
  const hasCancellation = shouldLoadCancellationState(order);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [cancellationState, setCancellationState] = useState(() => (hasCancellation ? { state: "loading" } : null));
  const [reloadToken, setReloadToken] = useState(0);
  const submitRef = useRef(null);

  useEffect(() => {
    if (!hasCancellation) {
      setCancellationState(null);
      return undefined;
    }
    let live = true;
    setCancellationState({ state: "loading" });
    loadCancellationState(client, orderId).then((next) => {
      if (live) setCancellationState(next);
    });
    return () => {
      live = false;
    };
  }, [client, orderId, hasCancellation, reloadToken]);

  function openConfirmation() {
    setReason("");
    setResult(null);
    setSubmitting(false);
    // One submitter per confirmation: it sends at most one POST, however often it is triggered.
    submitRef.current = createCancellationSubmitter({
      client,
      orderId,
      onSettled: async () => {
        setReloadToken((token) => token + 1);
        await onOrderChanged?.();
      },
    });
    setOpen(true);
  }

  async function handleSubmit() {
    const submit = submitRef.current;
    if (!submit || submitting || result || !validateCancellationReason(reason).ok) return;
    setSubmitting(true);
    const answer = await submit(reason);
    setSubmitting(false);
    if (answer.state !== "invalid") setResult(answer);
  }

  function handleClose() {
    if (!submitting) setOpen(false);
  }

  return (
    <>
      {canCancelOrder(order) ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={openConfirmation}
            className="globalTransition rounded-md border border-red-300 p-1 text-xs text-red-700 shadow-sm hover:bg-red-50 md:text-sm"
          >
            Cancel Order
          </button>
        </div>
      ) : null}
      {open ? (
        <CancelOrderModal
          order={order}
          reason={reason}
          submitting={submitting}
          result={result}
          onReasonChange={setReason}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
      ) : null}
      <CancellationStatePanel state={cancellationState} />
    </>
  );
};
