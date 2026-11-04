/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
// Runbook R1, the approved manual-payment procedure for a DRIVER payout paid in full by one payment:
//   1. reserve it (Processing), so neither the weekly pass nor an Admin transfer can take it;
//   2. pay exactly the amount still owed, outside Druppr;
//   3. record that payment's evidence, which completes the payout (PATCH /payouts/:id/status);
//   4. read the settlement back (GET /payouts/:id/external-payments) before calling it done.
// Partial or lump-sum payments are not recorded here: the approved procedure escalates them.
import { useState } from "react";
import customFetch from "../../utils/customFetch";
import { ConfirmDialog, ErrorState, LoadingRows, Notice } from "../moderation/ui";
import { primaryButton, secondaryButton } from "../moderation/styles";
import {
  buildCompletionRequest,
  driverName,
  formatCad,
  localToday,
  manualPaymentAvailability,
  refusalMessage,
  validateManualPayment,
  verifySettlement,
} from "../../utils/payoutPayments";
import { ManualPaymentForm, PaymentReview, PayoutModal, PayoutSummary } from "./payoutEvidence";
import { usePayoutRecord } from "./usePayoutRecord";

const EMPTY_FORM = {
  paymentMethod: "",
  paymentReference: "",
  paidOn: "",
  evidenceReference: "",
  recipientVerified: false,
  referenceVerified: false,
};

function Step({ number, title, done = false, children }) {
  return (
    <section className={`rounded-xl border p-4 ${done ? "border-emerald-200 bg-emerald-50" : "border-gray200 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${done ? "text-emerald-700" : "text-gray500"}`}>
        Step {number} of 3{done ? " · Done" : ""}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-gray900">{title}</h3>
      <div className="mt-2 space-y-3 text-sm text-gray700">{children}</div>
    </section>
  );
}

function LimitNote() {
  return (
    <p className="text-xs text-gray500">
      Paid only part of it, or one payment covering several payouts? Don&apos;t record it here: Admin records one payment that
      completes one payout. Leave the payout as it is and escalate it.
    </p>
  );
}

/** Props: id (payout), closeModal(), refresh() — reloads the list after any change. */
export const RecordManualPayment = ({ id, closeModal, refresh }) => {
  const record = usePayoutRecord(id);
  const { payout, evidence } = record;
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState(null);
  const today = localToday();

  const close = () => {
    if (!busy) closeModal(null);
  };

  async function reserve() {
    setBusy(true);
    setError("");
    try {
      await customFetch.patch(`/payouts/${id}/status`, { status: "processing" });
      if (refresh) refresh();
      await record.reload();
    } catch (failure) {
      setError(refusalMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function startReview(event) {
    event.preventDefault();
    const check = validateManualPayment(values, { today });
    setErrors(check.errors);
    setError("");
    if (check.ok) setReviewing(true);
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await customFetch.patch(`/payouts/${id}/status`, buildCompletionRequest(values, payout, evidence));
    } catch (failure) {
      setError(refusalMessage(failure));
      setBusy(false);
      return;
    }
    if (refresh) refresh();
    const fresh = await record.reload();
    setOutcome(verifySettlement(fresh?.evidence));
    setReviewing(false);
    setBusy(false);
  }

  let body;
  let footer = (
    <button type="button" className={secondaryButton} onClick={close} disabled={busy}>
      Close
    </button>
  );
  if (outcome) {
    body = (
      <>
        {payout ? <PayoutSummary payout={payout} evidence={evidence} /> : null}
        <Notice tone={outcome.ok ? "success" : "warning"} title={outcome.ok ? "Payment recorded" : "Check this payout before doing anything else"}>
          {outcome.message}
        </Notice>
      </>
    );
  } else if (record.status === "loading") {
    body = <LoadingRows label="Loading payout…" rows={3} />;
  } else if (record.status === "error") {
    body = <ErrorState error={record.error} onRetry={record.reload} />;
  } else {
    const availability = manualPaymentAvailability(payout, evidence);
    if (!availability.available) {
      body = (
        <>
          <PayoutSummary payout={payout} evidence={evidence} />
          <Notice tone="info" title="A manual payment can't be recorded">
            {availability.reason}
          </Notice>
        </>
      );
    } else if (availability.needsReservation) {
      body = (
        <>
          <PayoutSummary payout={payout} evidence={evidence} />
          <Step number={1} title="Reserve the payout">
            <p>
              Before you pay by hand, set this payout to <strong>Processing</strong>. Neither the weekly pass nor an Admin transfer can
              take a Processing payout, so it can&apos;t be paid twice.
            </p>
            {error ? <Notice tone="error">{error}</Notice> : null}
          </Step>
          <LimitNote />
        </>
      );
      footer = (
        <>
          <button type="button" className={secondaryButton} onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={primaryButton} onClick={reserve} disabled={busy}>
            {busy ? "Reserving…" : "Set to Processing"}
          </button>
        </>
      );
    } else {
      body = (
        <form id="manual-payment-form" onSubmit={startReview} noValidate className="space-y-4">
          <PayoutSummary payout={payout} evidence={evidence} />
          <Step number={1} title="Reserve the payout" done>
            <p>This payout is Processing: no transfer can take it.</p>
          </Step>
          <Step number={2} title="Pay outside Druppr">
            <p>
              Pay exactly <strong>{formatCad(evidence.remainingMinor)}</strong> to <strong>{driverName(payout.driver)}</strong> by bank
              transfer or e-Transfer. Keep the bank reference, and store the proof where your team keeps payment evidence.
            </p>
          </Step>
          <Step number={3} title="Record the evidence">
            <ManualPaymentForm
              payout={payout}
              remainingMinor={evidence.remainingMinor}
              values={values}
              errors={errors}
              onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
              disabled={busy}
              today={today}
            />
          </Step>
          {error && !reviewing ? <Notice tone="error">{error}</Notice> : null}
          <LimitNote />
        </form>
      );
      footer = (
        <>
          <button type="button" className={secondaryButton} onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="manual-payment-form" className={primaryButton} disabled={busy}>
            Review payment
          </button>
        </>
      );
    }
  }

  return (
    <>
      <PayoutModal title="Record a manual payment" onClose={close} busy={busy} footer={footer}>
        {body}
      </PayoutModal>
      {reviewing && payout && evidence ? (
        <ConfirmDialog
          title="Record this payment?"
          confirmLabel="Record payment"
          busyLabel="Recording…"
          busy={busy}
          error={error}
          onConfirm={confirm}
          onClose={() => {
            if (busy) return;
            setReviewing(false);
            setError("");
          }}
        >
          <PaymentReview payout={payout} request={buildCompletionRequest(values, payout, evidence)} />
        </ConfirmDialog>
      ) : null}
    </>
  );
};
