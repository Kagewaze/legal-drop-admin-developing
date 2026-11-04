/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
// A status change by hand (PATCH /payouts/:id/status with `status` alone). ⚠️ Never Completed: since backend e6c0fa7 a
// driver payout is completed only with the evidence of the payment that completes it (RecordManualPayment), and a
// seller payout never by a status change. The backend's refusal is shown in place, not only as a toast.
import { useState } from "react";
import customFetch from "../../utils/customFetch";
import { ErrorState, LoadingRows, Notice } from "../moderation/ui";
import { primaryButton, secondaryButton } from "../moderation/styles";
import { payoutStatusView, refusalMessage, statusChangeOptions } from "../../utils/payoutPayments";
import { PayoutModal, PayoutSummary, StatusChangeForm } from "./payoutEvidence";
import { usePayoutRecord } from "./usePayoutRecord";

/** Props: id (payout), closeModal(), refresh() — reloads the list after a change. */
export const UpdatePayoutStatus = ({ id, closeModal, refresh }) => {
  const record = usePayoutRecord(id);
  const { payout, evidence } = record;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const close = () => {
    if (!busy) closeModal(null);
  };

  async function save(event) {
    event.preventDefault();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      await customFetch.patch(`/payouts/${id}/status`, { status: value });
      setSaved(value);
      setValue("");
      if (refresh) refresh();
      await record.reload();
    } catch (failure) {
      setError(refusalMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const ready = record.status === "ready" || record.status === "refreshing";
  const canSave = ready && statusChangeOptions(payout, evidence).length > 0;

  return (
    <PayoutModal
      title="Update payout status"
      onClose={close}
      busy={busy}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={close} disabled={busy}>
            {canSave ? "Cancel" : "Close"}
          </button>
          {canSave ? (
            <button type="submit" form="payout-status-form" className={primaryButton} disabled={busy || !value}>
              {busy ? "Saving…" : "Save status"}
            </button>
          ) : null}
        </>
      }
    >
      {record.status === "loading" ? <LoadingRows label="Loading payout…" rows={3} /> : null}
      {record.status === "error" ? <ErrorState error={record.error} onRetry={record.reload} /> : null}
      {ready ? (
        <>
          <PayoutSummary payout={payout} evidence={evidence} />
          {saved ? (
            <Notice tone="success" title="Status updated">
              The payout is now {payoutStatusView({ ...payout, status: saved }, evidence).label}.
            </Notice>
          ) : null}
          <form id="payout-status-form" onSubmit={save} noValidate>
            <StatusChangeForm payout={payout} evidence={evidence} value={value} onChange={setValue} disabled={busy} />
          </form>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </>
      ) : null}
    </PayoutModal>
  );
};
