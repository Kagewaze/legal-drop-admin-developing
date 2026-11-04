// Payout payments as the deployed backend (e6c0fa7) accepts them:
//   PATCH /payouts/:id/status        a DRIVER payout becomes completed only with ONE verified external payment that
//                                    completes it; completed is final; a seller payout is never completed this way.
//   GET /payouts/:id/external-payments   owed, paid and remaining, each payment, the settlement, the holds.
// ⚠️ Nothing here decides money. These rules only keep Admin from offering what the backend refuses, and say why.
// The backend checks everything again, and its own refusal is always shown.
import { settlementStatusLabel } from "./payoutStatus";

export const PAYMENT_METHODS = [
  { value: "E_TRANSFER", label: "Interac e-Transfer" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
];
const METHOD_VALUES = PAYMENT_METHODS.map((method) => method.value);
const OPEN_STATUSES = ["pending", "processing", "failed"];

export const paymentMethodLabel = (value) =>
  PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value ?? "—";

/** The payout's driver as a person reads them: name, else email, never an empty string. */
export const driverName = (driver) =>
  [driver?.firstName, driver?.lastName].filter(Boolean).join(" ").trim() || driver?.email || "this payout's driver";

// ── Money and dates ──────────────────────────────────────────────────────────────────────────────────────────────

/** The API's CAD decimal string ("52.92") as minor units (5292); null when it is not a CAD amount. */
export function toMinor(amount) {
  const text = typeof amount === "number" ? amount.toFixed(2) : String(amount ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Minor units as the decimal string the backend expects ("52.92"). */
export function minorToDecimal(minor) {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "$1,234.56"; "—" when the amount is unknown, never a guessed zero. */
export function formatCad(minor) {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "—";
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-CA")}.${String(abs % 100).padStart(2, "0")}`;
}

/** Today in this browser's calendar, YYYY-MM-DD (what a date input holds). */
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A recorded calendar day (a payment's date paid) as YYYY-MM-DD, without shifting it through a time zone. */
export function formatDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ""));
  return match ? match[1] : "—";
}

// ── Status ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What a payout's status means, from the evidence the API returns. ⚠️ A completed payout never claims the money
 * reached a bank account (partnerReferral.test.js): it says which record completed it — a Stripe transfer, a manual
 * settlement, or none. `evidence` is undefined in the list, where only the payout row is known.
 */
export function payoutStatusView(payout, evidence) {
  const status = payout?.status;
  if (status === "pending") return { label: "Pending", tone: "warning", detail: "Waiting to be paid." };
  if (status === "processing")
    return { label: "Processing", tone: "info", detail: "Reserved for a manual payment: no transfer can take it." };
  if (status === "failed")
    return {
      label: "Failed",
      tone: "danger",
      detail: payout.failureReason ? `The last attempt failed: ${payout.failureReason}` : "The last attempt failed.",
    };
  if (status === "completed") {
    if (payout.stripeTransferId)
      return { label: "Transfer completed", tone: "success", detail: `Stripe transfer ${payout.stripeTransferId} is recorded.` };
    if (evidence?.settlement) {
      const count = evidence.settlement.paymentCount;
      return {
        label: "Manual settlement recorded",
        tone: "success",
        detail: `${count} payment${count === 1 ? "" : "s"} recorded outside Stripe settle the amount.`,
      };
    }
    if (evidence)
      return {
        label: "Completed — no payment evidence",
        tone: "warning",
        detail: "Marked completed before payment evidence was required. Reconcile it against bank records before relying on it.",
      };
    return { label: settlementStatusLabel("completed"), tone: "success", detail: "Open the details to see what completed it." };
  }
  return { label: status ? String(status) : "Unknown", tone: "neutral", detail: "" };
}

const STATUS_CHOICES = [
  { value: "pending", label: "Pending", description: "Waiting to be paid." },
  {
    value: "processing",
    label: "Processing",
    description: "Reserved for a manual payment. Neither the weekly pass nor an Admin transfer can take it.",
  },
  { value: "failed", label: "Failed", description: "Marks the payout as failed." },
];

/** Why no status change is possible, or null. Mirrors the refusals in PayoutService.updateStatus. */
export function statusChangeBlockedReason(payout, evidence) {
  if (!payout) return "This payout could not be loaded.";
  if (payout.status === "completed") return "This payout is completed, and completed is final. Its status can't change.";
  if (payout.stripeTransferId)
    return "A Stripe transfer is recorded for this payout. Its status follows reconciliation, not a manual change.";
  if (payout.deletedAt) return "This payout was deleted.";
  if (evidence?.settlement) return "A manual settlement is recorded for this payout. It is final.";
  if (evidence?.openHold)
    return "This payout is on a financial hold: it can only be settled in full with Record payment, or have its hold released.";
  return null;
}

/** The status changes offered by hand. Never `completed`: that needs payment evidence (Record payment). */
export function statusChangeOptions(payout, evidence) {
  if (statusChangeBlockedReason(payout, evidence)) return [];
  return STATUS_CHOICES.filter((choice) => choice.value !== payout.status);
}

/**
 * Whether a payment made outside Stripe can be recorded, and whether the payout must first be reserved
 * (set to Processing, runbook R1) so no transfer can take it while it is paid by hand.
 */
export function manualPaymentAvailability(payout, evidence) {
  const no = (reason) => ({ available: false, reason, needsReservation: false });
  if (!payout) return no("This payout could not be loaded.");
  if (payout.payeeType && payout.payeeType !== "driver")
    return no(
      "Seller payouts can't be completed from Admin. The backend records a seller payout as completed only from the Stripe transfer that pays it or a recorded settlement."
    );
  if (payout.status === "completed") return no("This payout is completed, and completed is final.");
  if (payout.deletedAt) return no("This payout was deleted, so it can't be paid.");
  if (payout.stripeTransferId)
    return no("A Stripe transfer is recorded for this payout. Reconcile it instead of recording a manual payment.");
  if (!OPEN_STATUSES.includes(payout.status)) return no(`A payout in status "${payout.status}" can't be paid outside Stripe.`);
  if (evidence?.settlement) return no("A manual settlement is already recorded for this payout. It is final.");
  if (evidence && !(evidence.remainingMinor > 0)) return no("Nothing remains to be paid on this payout.");
  return { available: true, reason: null, needsReservation: payout.status !== "processing" };
}

// ── The evidence of one payment ──────────────────────────────────────────────────────────────────────────────────

const printable = (text) => [...text].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127);

/** The same checks the backend makes on the evidence (UpdatePayoutStatusDto, PayoutService.externalPayment). */
export function validateManualPayment(form = {}, { today = localToday() } = {}) {
  const errors = {};
  if (!METHOD_VALUES.includes(form.paymentMethod)) errors.paymentMethod = "Choose how the money was sent.";

  const reference = typeof form.paymentReference === "string" ? form.paymentReference.trim() : "";
  if (reference.length < 3 || reference.length > 120)
    errors.paymentReference = "Enter the payment's bank or e-Transfer reference (3 to 120 characters).";
  else if (reference.replace(/[^A-Za-z0-9]/g, "").length < 3)
    errors.paymentReference = "A payment reference needs at least 3 letters or digits.";
  else if (!printable(reference)) errors.paymentReference = "Use printable characters only.";

  const paidOn = typeof form.paidOn === "string" ? form.paidOn : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) errors.paidOn = "Enter the date the money was sent.";
  else {
    const day = new Date(`${paidOn}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== paidOn) errors.paidOn = "Enter a real date.";
    else if (paidOn > today) errors.paidOn = "The date paid can't be in the future.";
  }

  const evidence = typeof form.evidenceReference === "string" ? form.evidenceReference : "";
  if (evidence.trim().length < 3 || evidence.length > 200)
    errors.evidenceReference = "Say where the proof is kept (3 to 200 characters), for example EVID-2026-11-0012.";
  else if (!printable(evidence)) errors.evidenceReference = "Use printable characters only.";

  if (form.recipientVerified !== true)
    errors.recipientVerified = "Confirm the bank record shows this payout's driver as the recipient.";
  if (form.referenceVerified !== true)
    errors.referenceVerified = "Confirm you checked the payment reference against the bank record.";
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * The PATCH body that completes a driver payout with one payment: exactly the evidence fields, for the amount still
 * owed (the whole amount, or the remainder of a held payout). The recipient is always the payout's own driver.
 */
export function buildCompletionRequest(form, payout, evidence) {
  return {
    status: "completed",
    paymentMethod: form.paymentMethod,
    paymentReference: form.paymentReference.trim(),
    paidOn: form.paidOn,
    settledAmount: minorToDecimal(evidence.remainingMinor),
    recipientId: payout.driverId,
    recipientVerified: form.recipientVerified === true,
    evidenceReference: form.evidenceReference.trim(),
    referenceVerified: form.referenceVerified === true,
  };
}

/** After a completion: the settlement read back from the backend must show the payout paid in full. */
export function verifySettlement(evidence) {
  if (!evidence) return { ok: false, message: "The payment evidence could not be read back. Open the payout's details before doing anything else." };
  const standing = (evidence.payments || []).filter((payment) => !payment.reversedAt);
  if (evidence.settlement && evidence.remainingMinor === 0 && standing.length > 0)
    return {
      ok: true,
      message: `Settlement recorded: ${standing.length} payment${standing.length === 1 ? "" : "s"} totalling ${formatCad(
        evidence.paidMinor
      )}, ${formatCad(0)} still owed.`,
    };
  return {
    ok: false,
    message: "The payout was updated, but its settlement does not read back as complete. Don't record anything else: escalate it.",
  };
}

// ── Refusals ─────────────────────────────────────────────────────────────────────────────────────────────────────

const HINTS = [
  [/COMPLETED_PAYOUT_IS_FINAL/, "Completed is final, so nothing was changed."],
  [
    /Provider-managed payout requires reconciliation|Stripe transfer for this payout may already exist/i,
    "Stop: a Stripe transfer may exist for this payout. Don't record or repeat a payment; escalate it for reconciliation.",
  ],
  [/already recorded against a payout/i, "Check the bank record. Never invent a new reference to get past this."],
  [/would overpay|does not complete the payout/i, "The amount must be exactly what is still owed on this payout."],
  [/financial hold/i, "Settle the amount still owed, or have the hold released."],
];

/** The backend's own words, with the safe next step for the refusals that need one. */
export function refusalMessage(error) {
  if (!error) return "The request could not be completed.";
  const response = error.response;
  if (!response) return "Admin could not reach the server. Check your connection and try again; nothing was recorded.";
  if (response.status === 403) return "Administrator access is required for this action. Nothing was changed.";
  const raw = response.data?.message;
  const text = Array.isArray(raw)
    ? raw.join("; ")
    : typeof raw === "string" && raw.trim()
      ? raw.trim()
      : `The request was refused (HTTP ${response.status}).`;
  const hint = HINTS.find(([pattern]) => pattern.test(text));
  return hint ? `${text} — ${hint[1]}` : text;
}

/** A failed load, in the shape the shared ErrorState shows. */
export function loadErrorOf(error) {
  const status = error?.response?.status;
  if (status === 403) return { kind: "forbidden", message: "Administrator access is required to view payouts." };
  if (status === 404) return { kind: "not_found", message: "This payout was not found." };
  return { kind: "unavailable", message: refusalMessage(error) };
}
