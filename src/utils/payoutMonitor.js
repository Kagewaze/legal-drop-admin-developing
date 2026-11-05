// The read-only payout monitor's rules, for the endpoints the deployed backend (e6c0fa7) serves. All of them are GETs:
//   GET /payouts                                    driver payouts, paged; meta.itemCount gives each status's count
//   GET /payouts/:id/external-payments              what is recorded as paid for one payout
//   GET /payouts/transfer-runs                      the weekly transfer passes, newest first
//   GET /payouts/funding-queue                      payouts of every programme waiting for funding, oldest due first
//   GET /payouts/integrity/unevidenced-completions  completed payouts with no Stripe transfer and no settlement
//   GET /payouts/legacy-liabilities                 historical payouts that need an operator's review before any transfer
// ⚠️ Every figure is the backend's own. One that could not be read is unknown ("—"), never zero, and a list the backend
// caps is never presented as complete.
import { getFormattedDateTime } from "./dateTime";
import { formatCad } from "./payoutPayments";

export const PAGE_SIZE = 10;
export const RUN_LIMIT = 20;
export const QUEUE_LIMIT = 50;
export const REVIEW_LIMIT = 50;
export const MONITOR_STATUSES = ["pending", "processing", "completed", "failed"];

const DOMAINS = {
  DRIVER: "Driver",
  MARKETPLACE_SELLER: "Marketplace seller",
  PARTNER: "Partner Program",
  UNKNOWN: "Unidentified",
};
/** The programme a payout belongs to, as the backend names it. */
export const domainLabel = (domain) => DOMAINS[domain] ?? (domain ? String(domain) : "—");

// Plain words only for codes whose meaning the backend states; any other code is shown as its own words.
const CODES = {
  DEFERRED_INSUFFICIENT_FUNDS: "Deferred: platform balance too low",
  DEFERRED_QUEUED_BEHIND_OLDER: "Deferred: older payouts first",
  LEGACY_AUTHORITY_REQUIRED: "Legacy review required",
};

/** A backend code in words, e.g. "PROVIDER_REJECTED" -> "Provider rejected". */
export function codeLabel(code) {
  if (code === null || code === undefined || code === "") return "—";
  if (CODES[code]) return CODES[code];
  const words = String(code).toLowerCase().replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Minor units as the API sends them (large integers arrive as strings); null when it is not a number. */
export function minorOf(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}
export const money = (value) => formatCad(minorOf(value));
export const when = (value) => (value ? getFormattedDateTime(value) : "—");

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * What is on record as paid for one payout. `evidence` is GET /payouts/:id/external-payments `data`: undefined while it
 * loads, null when it could not be read. Like the details view, it never claims the money reached a bank account.
 */
export function evidenceIndicator(payout, evidence) {
  if (evidence === undefined) return { label: "Checking…", tone: "neutral", detail: "" };
  if (!evidence) return { label: "Not available", tone: "neutral", detail: "The payment record could not be read." };
  const reversed = (evidence.payments || []).filter((payment) => payment.reversedAt).length;
  const note = reversed ? ` ${plural(reversed, "reversed payment")} on record.` : "";
  if (payout?.stripeTransferId) {
    if (payout.status === "completed")
      return { label: "Stripe transfer", tone: "success", detail: `Transfer ${payout.stripeTransferId} is recorded.${note}` };
    return {
      label: "Transfer to reconcile",
      tone: "danger",
      detail: `A Stripe transfer is recorded, but the payout is ${payout.status}. Reconcile it.`,
    };
  }
  if (evidence.settlement)
    return { label: "Manual settlement", tone: "success", detail: `${formatCad(evidence.paidMinor)} recorded outside Stripe.${note}` };
  if (evidence.openHold)
    return {
      label: "On financial hold",
      tone: "warning",
      detail: `${formatCad(evidence.paidMinor)} recorded, ${formatCad(evidence.remainingMinor)} still owed.${note}`,
    };
  if (payout?.status === "completed")
    return { label: "No payment evidence", tone: "warning", detail: `Completed with no transfer and no settlement: reconcile it.${note}` };
  if (evidence.paidMinor > 0)
    return {
      label: "Partly paid",
      tone: "warning",
      detail: `${formatCad(evidence.paidMinor)} recorded, ${formatCad(evidence.remainingMinor)} still owed.${note}`,
    };
  return { label: "No payment yet", tone: "neutral", detail: `${formatCad(evidence.remainingMinor)} owed.${note}` };
}

const RUN_STATUS = {
  RUNNING: { label: "Running", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  INTERRUPTED: { label: "Interrupted", tone: "danger" },
};
const TRIGGERS = { WEEKLY: "Weekly driver and seller pass", PARTNER_WEEKLY: "Weekly Partner Program pass" };
const ALERTS = {
  NOT_REQUIRED: { label: "No alert needed", tone: "neutral" },
  EMAILED: { label: "Alert emailed", tone: "info" },
  LOG_ONLY_EMAIL_NOT_CONFIGURED: { label: "Alert logged only: no email set up", tone: "warning" },
  EMAIL_FAILED: { label: "Alert email failed", tone: "danger" },
};

function recordOf(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" ? parsed : {};
}

/** One weekly transfer pass, as its own run record states it (GET /payouts/transfer-runs). */
export function transferRunView(run) {
  const record = recordOf(run?.outcomes);
  const counts = Object.entries(recordOf(record.counts))
    .map(([code, count]) => ({ code, label: codeLabel(code), count: Number(count) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const claimFailures = Number(run?.claimFailures) || 0;
  return {
    status: RUN_STATUS[run?.status] ?? { label: codeLabel(run?.status), tone: "neutral" },
    trigger: TRIGGERS[run?.trigger] ?? codeLabel(run?.trigger),
    counts,
    payouts: Array.isArray(record.payouts) ? record.payouts : [],
    claimFailures,
    alert: run?.alertRequired ? ALERTS[run.alertDelivery] ?? { label: "Alert required", tone: "warning" } : ALERTS.NOT_REQUIRED,
    deferredMinor: minorOf(run?.deferredMinor),
    needsAttention: run?.status === "INTERRUPTED" || run?.alertRequired === true || claimFailures > 0,
  };
}

/** A payout waiting for funding (GET /payouts/funding-queue): over 7 days past due is overdue, over 14 urgent. */
export function queueEntryView(entry) {
  if (entry?.urgent === true) return { label: "Urgent", tone: "danger" };
  if (entry?.overdue === true) return { label: "Overdue", tone: "warning" };
  return { label: "Waiting", tone: "info" };
}

const isCount = (value) => Number.isInteger(value) && value >= 0;
const capped = (rows, limit) => (Array.isArray(rows) ? { count: rows.length, more: rows.length >= limit } : null);
const shown = (list) => (list ? `${list.count}${list.more ? "+" : ""}` : "—");
const unknown = (part) => (part?.loading ? "Loading…" : "Could not be read.");

/**
 * The figures that need a person, each from one read ({ loading, error, value }). A read that failed or has not
 * answered shows "—", never zero; a list the backend caps at its limit shows "50+", never a total.
 */
export function attentionItems({ counts, runs, queue, unevidenced, legacy } = {}) {
  const failedCount = counts?.value?.failed;
  const waiting = capped(queue?.value, QUEUE_LIMIT);
  const overdue = waiting ? queue.value.filter((entry) => entry.overdue === true).length : 0;
  const urgent = waiting ? queue.value.filter((entry) => entry.urgent === true).length : 0;
  const review = capped(legacy?.value, REVIEW_LIMIT);
  const missing = unevidenced?.value;
  const runList = Array.isArray(runs?.value) ? runs.value : null;
  const latest = runList?.[0];
  const run = latest ? transferRunView(latest) : null;
  return [
    {
      key: "failed",
      title: "Failed driver payouts",
      value: isCount(failedCount) ? String(failedCount) : "—",
      tone: !isCount(failedCount) ? "neutral" : failedCount > 0 ? "danger" : "success",
      detail: !isCount(failedCount) ? unknown(counts) : failedCount > 0 ? "Their last attempt failed." : "None has failed.",
    },
    {
      key: "unevidenced",
      title: "Completed without evidence",
      value: isCount(missing?.total) ? String(missing.total) : "—",
      tone: !isCount(missing?.total) ? "neutral" : missing.total > 0 ? "warning" : "success",
      detail: !isCount(missing?.total)
        ? unknown(unevidenced)
        : `${money(missing.amountMinor)} · ${missing.byDomain?.DRIVER ?? 0} driver, ${missing.byDomain?.MARKETPLACE_SELLER ?? 0} seller`,
    },
    {
      key: "queue",
      title: "Waiting for funding",
      value: shown(waiting),
      tone: !waiting ? "neutral" : urgent > 0 ? "danger" : overdue > 0 ? "warning" : waiting.count > 0 ? "info" : "success",
      detail: !waiting ? unknown(queue) : `${overdue} overdue · ${urgent} urgent${waiting.more ? ` · first ${QUEUE_LIMIT} loaded` : ""}`,
    },
    {
      key: "legacy",
      title: "Legacy review needed",
      value: shown(review),
      tone: !review ? "neutral" : review.count > 0 ? "warning" : "success",
      detail: !review
        ? unknown(legacy)
        : review.count === 0
          ? "None waiting."
          : review.more
            ? `First ${REVIEW_LIMIT} loaded.`
            : "Each needs a review before any transfer.",
    },
    {
      key: "run",
      title: "Last transfer run",
      value: !runList ? "—" : run ? run.status.label : "None recorded",
      tone: !run ? "neutral" : run.needsAttention ? "warning" : run.status.tone,
      detail: !runList ? unknown(runs) : run ? `${when(latest.startedAt)} · ${run.alert.label}` : "No weekly pass has been recorded.",
    },
  ];
}
