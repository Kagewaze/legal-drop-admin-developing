/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
// The payout views, presentational only: they render what the API returned and never request anything.
// Built from the operations look the moderation screens share (Badge, Notice, Facts, IdText and their styles).
import { useEffect, useId, useRef } from "react";
import { MdClose } from "react-icons/md";
import { Badge, Facts, IdText, Notice } from "../moderation/ui";
import { cardClass, cellClass, controlClass, eyebrowClass, headCellClass, labelClass, tableWrapClass } from "../moderation/styles";
import { getFormattedDateTime } from "../../utils/dateTime";
import {
  PAYMENT_METHODS,
  driverName,
  formatCad,
  formatDay,
  paymentMethodLabel,
  payoutStatusView,
  statusChangeBlockedReason,
  statusChangeOptions,
  toMinor,
} from "../../utils/payoutPayments";

const when = (value) => (value ? getFormattedDateTime(value) : "—");

/** A payout's status, from its evidence when it is known. Props: payout, evidence (optional). */
export function PayoutStatusBadge({ payout, evidence }) {
  const view = payoutStatusView(payout, evidence);
  return <Badge tone={view.tone}>{view.label}</Badge>;
}

/**
 * A modal frame: labelled, focus moved in and returned, Escape closes unless a request is in flight.
 * Props: title, onClose, busy, wide, children, footer.
 */
export function PayoutModal({ title, onClose, busy = false, wide = false, children, footer }) {
  const titleId = useId();
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => {
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);
  return (
    <div
      className="modalBG"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onClose();
          }
        }}
        className={`flex max-h-[92vh] w-full flex-col rounded-xl bg-white shadow-xl outline-none ${wide ? "max-w-[880px]" : "max-w-[620px]"}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray200 px-5 py-4">
          <div>
            <p className={eyebrowClass}>Driver payouts</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-gray900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1 text-gray500 transition hover:bg-gray100 hover:text-gray800 focus:outline-none focus:ring-4 focus:ring-[#ede7ff] disabled:opacity-50"
          >
            <MdClose size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-gray700">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t border-gray200 px-5 py-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

/** Who is owed, how much and in what state. Props: payout, evidence (optional). */
export function PayoutSummary({ payout, evidence }) {
  const driver = payout?.driver;
  return (
    <div className="rounded-xl border border-gray200 bg-gray50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray900">{driverName(driver)}</p>
          <p className="text-sm text-gray600">{[driver?.email, driver?.phoneNumber].filter(Boolean).join(" · ") || "No contact on record"}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-gray900">{formatCad(toMinor(payout?.amount))}</p>
          <PayoutStatusBadge payout={payout} evidence={evidence} />
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray600">
        <div className="flex items-center gap-1">
          <dt>Payout</dt>
          <dd>
            <IdText id={payout?.id} label="payout" />
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt>Created</dt>
          <dd className="font-medium text-gray700">{when(payout?.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Amount({ label, minor, emphasis = false }) {
  return (
    <div className={`rounded-lg border p-3 ${emphasis ? "border-[#dcd0ff] bg-[#faf8ff]" : "border-gray200 bg-white"}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray500">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${emphasis ? "text-lg text-[#5b2bc4]" : "text-base text-gray900"}`}>{formatCad(minor)}</dd>
    </div>
  );
}

function PaymentsTable({ payments }) {
  return (
    <div className={tableWrapClass}>
      <table className="w-full min-w-[680px] text-left text-sm">
        <caption className="sr-only">Payments recorded outside Stripe</caption>
        <thead className="bg-gray50">
          <tr>
            {["Amount", "Method", "Reference", "Date paid", "Evidence", "Recorded", "State"].map((heading) => (
              <th key={heading} scope="col" className={headCellClass}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray100">
          {payments.map((payment) => (
            <tr key={payment.id} className={payment.reversedAt ? "bg-gray50 text-gray500" : "bg-white"}>
              <td className={`${cellClass} whitespace-nowrap font-semibold`}>{formatCad(payment.amountMinor)}</td>
              <td className={`${cellClass} whitespace-nowrap`}>{paymentMethodLabel(payment.paymentMethod)}</td>
              <td className={cellClass}>
                <code className="rounded bg-gray100 px-1.5 py-0.5 text-xs text-gray800">{payment.paymentReference}</code>
              </td>
              <td className={`${cellClass} whitespace-nowrap`}>{formatDay(payment.paidOn)}</td>
              <td className={`${cellClass} break-words`}>{payment.evidenceReference}</td>
              <td className={`${cellClass} whitespace-nowrap`}>{when(payment.recordedAt)}</td>
              <td className={`${cellClass} whitespace-nowrap`}>
                {payment.reversedAt ? <Badge tone="neutral">Reversed</Badge> : <Badge tone="success">Standing</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What is recorded about money paid for this payout: amounts, a Stripe transfer, the settlement, an open hold and
 * each payment made outside Stripe. Props: payout, evidence (GET /payouts/:id/external-payments `data`).
 */
export function PaymentEvidencePanel({ payout, evidence }) {
  const view = payoutStatusView(payout, evidence);
  const payments = evidence?.payments ?? [];
  const settlement = evidence?.settlement;
  const hold = evidence?.openHold;
  const unevidenced = payout?.status === "completed" && !settlement && !payout?.stripeTransferId;
  return (
    <section aria-labelledby="payout-evidence-title" className={`${cardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={eyebrowClass}>What is on record</p>
          <h3 id="payout-evidence-title" className="mt-1 text-base font-semibold text-gray900">
            Payment evidence
          </h3>
        </div>
        <PayoutStatusBadge payout={payout} evidence={evidence} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Amount label="Amount owed" minor={evidence?.owedMinor} />
        <Amount label="Recorded payments" minor={evidence?.paidMinor} />
        <Amount label="Still owed" minor={evidence?.remainingMinor} emphasis />
      </dl>
      {payout?.stripeTransferId ? (
        <Notice tone="info" title="Stripe transfer recorded">
          <Facts
            facts={[
              ["Transfer", <code key="transfer" className="text-xs">{payout.stripeTransferId}</code>],
              ["Transferred", when(payout.transferredAt)],
            ]}
          />
        </Notice>
      ) : null}
      {settlement ? (
        <Notice tone="success" title="Manual settlement recorded">
          <Facts
            facts={[
              ["Amount", formatCad(settlement.amountMinor)],
              ["Payments", String(settlement.paymentCount)],
              ["Evidence", settlement.evidenceReference],
              ["Approved by", <IdText key="approver" id={settlement.approvedBy} label="approver" />],
              ["Recorded", when(settlement.createdAt)],
            ]}
          />
        </Notice>
      ) : null}
      {hold ? (
        <Notice tone="warning" title="On a financial hold">
          A partial payment is recorded, so no transfer can pay this payout. Only a payment of the amount still owed (
          {formatCad(evidence?.remainingMinor)}) can complete it.
        </Notice>
      ) : null}
      {unevidenced && evidence ? (
        <Notice tone="warning" title="Completed — no payment evidence">
          {view.detail}
        </Notice>
      ) : null}
      {payments.length ? (
        <PaymentsTable payments={payments} />
      ) : (
        <p className="text-sm text-gray600">No payment made outside Stripe is recorded for this payout.</p>
      )}
    </section>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      <p id={`${id}-help`} className={`mt-1 text-xs ${error ? "font-medium text-rose-700" : "text-gray500"}`}>
        {error || hint}
      </p>
    </div>
  );
}

function Check({ id, checked, onChange, disabled, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-gray700">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-help` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#6d3adf]"
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-help`} className="mt-1 pl-7 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The evidence of ONE payment made outside Stripe. The amount is fixed: the backend accepts exactly what is still
 * owed. Props: payout, remainingMinor, values, errors, onChange(field, value), disabled, today (YYYY-MM-DD).
 */
export function ManualPaymentForm({ payout, remainingMinor, values, errors = {}, onChange, disabled = false, today }) {
  const driver = payout?.driver;
  const name = driverName(driver);
  const set = (field) => (event) => onChange(field, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  const control = (field) => ({
    id: field,
    disabled,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": `${field}-help`,
    className: controlClass,
  });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#dcd0ff] bg-[#faf8ff] p-4">
        <p className={eyebrowClass}>Amount of this payment</p>
        <p className="mt-1 text-2xl font-semibold text-gray900">{formatCad(remainingMinor)}</p>
        <p className="mt-1 text-sm text-gray600">
          It must complete the payout: the backend accepts exactly the amount still owed, paid to {name}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="paymentMethod" label="Payment method" hint="How the money was sent." error={errors.paymentMethod}>
          <select {...control("paymentMethod")} value={values.paymentMethod} onChange={set("paymentMethod")}>
            <option value="" disabled>
              Choose a method
            </option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="paidOn" label="Date paid" hint="The day the money was sent." error={errors.paidOn}>
          <input {...control("paidOn")} type="date" max={today} value={values.paidOn} onChange={set("paidOn")} />
        </Field>
      </div>
      <Field id="paymentReference" label="Payment reference" hint="The bank or e-Transfer reference of this payment." error={errors.paymentReference}>
        <input
          {...control("paymentReference")}
          type="text"
          maxLength={120}
          autoComplete="off"
          spellCheck={false}
          value={values.paymentReference}
          onChange={set("paymentReference")}
        />
      </Field>
      <Field
        id="evidenceReference"
        label="Evidence reference"
        hint="Where the proof is kept, for example EVID-2026-11-0012. A reference, never the document itself."
        error={errors.evidenceReference}
      >
        <input
          {...control("evidenceReference")}
          type="text"
          maxLength={200}
          autoComplete="off"
          value={values.evidenceReference}
          onChange={set("evidenceReference")}
        />
      </Field>
      <fieldset className="space-y-3 rounded-xl border border-gray200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray700">Checked against the bank record</legend>
        <Check id="recipientVerified" checked={values.recipientVerified} onChange={set("recipientVerified")} disabled={disabled} error={errors.recipientVerified}>
          The payment went to <strong>{name}</strong>
          {driver?.email ? ` (${driver.email})` : ""}, this payout&apos;s driver.
        </Check>
        <Check id="referenceVerified" checked={values.referenceVerified} onChange={set("referenceVerified")} disabled={disabled} error={errors.referenceVerified}>
          The payment reference above matches the bank record.
        </Check>
      </fieldset>
    </div>
  );
}

/** What will be recorded, for the confirmation. Props: payout, request (the PATCH body). */
export function PaymentReview({ payout, request }) {
  const rows = [
    ["Amount", formatCad(toMinor(request.settledAmount))],
    ["Paid to", driverName(payout?.driver)],
    ["Method", paymentMethodLabel(request.paymentMethod)],
    ["Reference", request.paymentReference],
    ["Date paid", request.paidOn],
    ["Evidence", request.evidenceReference],
  ];
  return (
    <>
      <p>
        You are recording a payment made outside Druppr. The payout becomes <strong>Completed</strong> as soon as it is recorded.
      </p>
      <dl className="grid gap-3 rounded-xl border border-gray200 bg-gray50 p-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray500">{label}</dt>
            <dd className="mt-0.5 break-words font-semibold text-gray900">{value}</dd>
          </div>
        ))}
      </dl>
      <Notice tone="warning" title="Completed is final">
        Once recorded, this payout can&apos;t change status or be paid again. Check every detail against the bank record before you confirm.
      </Notice>
    </>
  );
}

/**
 * The status changes the backend accepts by hand. Never Completed: that needs payment evidence.
 * Props: payout, evidence, value, onChange(status), disabled.
 */
export function StatusChangeForm({ payout, evidence, value, onChange, disabled = false }) {
  const blocked = statusChangeBlockedReason(payout, evidence);
  if (blocked) return <Notice tone="info" title="The status can't be changed here">{blocked}</Notice>;
  return (
    <fieldset className="space-y-2">
      <legend className={`${labelClass} mb-1`}>New status</legend>
      {statusChangeOptions(payout, evidence).map((option) => (
        <label
          key={option.value}
          htmlFor={`status-${option.value}`}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
            value === option.value ? "border-[#6d3adf] bg-[#faf8ff]" : "border-gray200 bg-white hover:border-[#8a5cf6]"
          }`}
        >
          <input
            id={`status-${option.value}`}
            type="radio"
            name="payout-status"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
            className="mt-1 h-4 w-4 shrink-0 accent-[#6d3adf]"
          />
          <span>
            <span className="block text-sm font-semibold text-gray900">{option.label}</span>
            <span className="block text-sm text-gray600">{option.description}</span>
          </span>
        </label>
      ))}
      <p className="pt-1 text-xs text-gray500">
        To complete a driver payout, use <strong>Record payment</strong>: completion needs the payment&apos;s evidence.
      </p>
    </fieldset>
  );
}
