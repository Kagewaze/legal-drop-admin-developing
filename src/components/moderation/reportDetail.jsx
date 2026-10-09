/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  NOTE_MAX_LENGTH,
  accountRestrictionView,
  availableReportActions,
  decisionFollowUp,
  decisionLabel,
  decisionOptions,
  evidenceSnapshotView,
  formatDateTime,
  listingStatusLabel,
  reasonLabel,
  reportStage,
  targetKindLabel,
  targetTypeLabel,
  validateNote,
} from "../../utils/moderation";
import { HistoryList } from "./auditViews";
import { cardClass, eyebrowClass, linkClass, primaryButton, secondaryButton } from "./styles";
import { Badge, Facts, IdText, Notice, ReasonField } from "./ui";

const noteLimit = (capabilities) => capabilities?.limits?.noteMaxLength ?? NOTE_MAX_LENGTH;

function Field({ label, children }) {
  return (
    <div className="rounded-lg bg-gray50 p-3">
      <dt className={eyebrowClass}>{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-gray900">{children}</dd>
    </div>
  );
}

/** Where the report stands. Props: report. */
export function ReportStatus({ report }) {
  const stage = reportStage(report);
  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <Badge tone={stage.tone}>{stage.label}</Badge>
      {stage.outcome ? <span className="text-sm font-medium text-gray700">{stage.outcome}</span> : null}
    </div>
  );
}

/**
 * What the reporter says. ⚠️ AN ALLEGATION: it is labelled as unverified everywhere it appears and
 * is never worded as a finding. Props: report.
 */
export function AllegationCard({ report }) {
  return (
    <section aria-labelledby="report-allegation" className={cardClass}>
      <h2 id="report-allegation" className="text-lg font-semibold text-gray900">
        Allegation <span className="ml-1 align-middle"><Badge tone="info">Unverified</Badge></span>
      </h2>
      <p className="mt-1 text-sm text-gray600">This is what the reporter says. It has not been confirmed.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Report ID">
          <IdText id={report.id} label="report" />
        </Field>
        <Field label="Submitted">{formatDateTime(report.createdAt)}</Field>
        <Field label="Reason given">{reasonLabel(report.reason)}</Field>
        <Field label="About">
          {targetTypeLabel(report.targetType)}
          {report.targetKind ? ` · ${targetKindLabel(report.targetKind)}` : ""}
        </Field>
      </dl>
      <h3 className={`${eyebrowClass} mt-4`}>Reporter&apos;s explanation</h3>
      {report.details ? (
        <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-4 border-gray300 pl-3 text-sm text-gray800">
          {report.details}
        </blockquote>
      ) : (
        <p className="mt-2 text-sm text-gray600">The reporter gave no explanation.</p>
      )}
    </section>
  );
}

function AccountBlock({ heading, id, account, label, children }) {
  const view = accountRestrictionView(account);
  return (
    <div className="rounded-lg border border-gray200 p-4">
      <h3 className={eyebrowClass}>{heading}</h3>
      <p className="mt-2 font-semibold text-gray900">{account?.name ?? "Name unavailable"}</p>
      <p className="mt-1 text-sm text-gray600">
        ID <IdText id={id} label={label} />
      </p>
      <p className="mt-3">
        <Badge tone={view.tone}>{view.label}</Badge>
      </p>
      {view.detail ? <p className="mt-1 text-sm text-gray600">{view.detail}</p> : null}
      {children}
    </div>
  );
}

/**
 * The reporter and the reported account, as the moderation API describes them.
 * ⚠️ Each account's chip is derived from `accessRestricted`, not from the recorded status alone.
 * Props: report.
 */
export function AccountsCard({ report }) {
  const counts = report.reported?.reports;
  return (
    <section aria-labelledby="report-accounts" className={cardClass}>
      <h2 id="report-accounts" className="text-lg font-semibold text-gray900">
        Accounts
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <AccountBlock heading="Reported account" id={report.reportedUserId} account={report.reported} label="reported account">
          {counts ? (
            <p className="mt-3 text-sm text-gray700">
              Reported {counts.total} time{counts.total === 1 ? "" : "s"} in total; {counts.actioned} upheld.
            </p>
          ) : null}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link to="/moderation/reports" state={{ filters: { reportedUserId: report.reportedUserId } }} className={linkClass}>
              Reports about this account
            </Link>
            <Link to="/moderation/audit" state={{ filters: { subjectType: "user", subjectId: report.reportedUserId } }} className={linkClass}>
              Audit history for this account
            </Link>
          </p>
        </AccountBlock>
        <AccountBlock heading="Reporter" id={report.reporterUserId} account={report.reporter} label="reporter" />
      </div>
    </section>
  );
}

/**
 * The snapshot the reporter submitted, and what the target looks like now.
 * ⚠️ Reported photos are never loaded into the page: they are counted, and their links are shown
 * only when asked for. Props: report.
 */
export function EvidenceSnapshotCard({ report }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const snapshot = evidenceSnapshotView(report);
  return (
    <section aria-labelledby="report-evidence" className={cardClass}>
      <h2 id="report-evidence" className="text-lg font-semibold text-gray900">
        Evidence submitted with the report
      </h2>
      <p className="mt-1 text-sm text-gray600">
        A snapshot taken when the report was filed. The original may have been edited or removed since.
      </p>

      {snapshot.kind === "account" ? (
        <p className="mt-4 text-sm text-gray700">No content is captured for a report about an account.</p>
      ) : null}

      {snapshot.kind === "listing" ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Title when reported">{snapshot.title ?? "Not captured"}</Field>
            <Field label="Price when reported">{snapshot.price ?? "Not captured"}</Field>
            <Field label="Status when reported">{snapshot.statusWhenReported ?? "Not captured"}</Field>
          </dl>
          <h3 className={`${eyebrowClass} mt-4`}>Description when reported</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray800">
            {snapshot.description ?? "Not captured"}
            {snapshot.descriptionTruncated ? <span className="ml-1 text-gray500">(truncated)</span> : null}
          </p>
          <div className="mt-4 text-sm text-gray700">
            {snapshot.photos.length ? (
              <>
                <p>
                  {snapshot.photos.length} photo{snapshot.photos.length === 1 ? "" : "s"} captured. Photos are not loaded
                  into this page.
                </p>
                <button type="button" className={`${secondaryButton} mt-2`} aria-expanded={showPhotos} aria-controls="report-photo-links" onClick={() => setShowPhotos(!showPhotos)}>
                  {showPhotos ? "Hide photo links" : "Show photo links"}
                </button>
                {showPhotos ? (
                  <ul id="report-photo-links" className="mt-2 flex flex-wrap gap-3">
                    {snapshot.photos.map((href, index) => (
                      <li key={href}>
                        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                          Open photo {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p>No photos were captured.</p>
            )}
          </div>
          <h3 className={`${eyebrowClass} mt-4`}>The listing now</h3>
          {report.target?.exists ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray800">
              <span className="font-medium">{report.target.title}</span>
              <Badge tone={report.target.status === "removed" ? "danger" : "neutral"}>{listingStatusLabel(report.target.status)}</Badge>
              <span className="inline-flex items-center gap-1 text-gray600">
                ID <IdText id={report.targetId} label="listing" />
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray700">The listing no longer exists.</p>
          )}
        </>
      ) : null}

      {snapshot.kind === "message" ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Where">{snapshot.sourceLabel}</Field>
            <Field label="Sent">{formatDateTime(snapshot.sentAt)}</Field>
            <Field label="Message ID">
              <IdText id={report.targetId} label="message" />
            </Field>
          </dl>
          <h3 className={`${eyebrowClass} mt-4`}>Reported message</h3>
          <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-4 border-amber-300 pl-3 text-sm text-gray900">
            {snapshot.body ?? "Not captured"}
            {snapshot.bodyTruncated ? <span className="ml-1 text-gray500">(truncated)</span> : null}
          </blockquote>
          {snapshot.attachmentCount ? (
            <p className="mt-2 text-sm text-gray700">
              {snapshot.attachmentCount} attachment{snapshot.attachmentCount === 1 ? "" : "s"} (not loaded).
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * Reviewing and deciding. ⚠️ A DECISION RECORDS WHAT WAS CONCLUDED AND NOTHING ELSE: this card
 * never says a listing was removed or an account suspended. Once a decision exists it shows
 * whether the thing the decision names has actually happened (decisionFollowUp).
 * Props: report, capabilities, busy, onStartReview(), onRequestResolve(decision, note).
 */
export function DecisionCard({ report, capabilities, busy, onStartReview, onRequestResolve }) {
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const actions = availableReportActions(report);
  const max = noteLimit(capabilities);
  const followUp = decisionFollowUp(report);

  if (!actions.canResolve) {
    return (
      <section aria-labelledby="report-decision" className={cardClass}>
        <h2 id="report-decision" className="text-lg font-semibold text-gray900">
          Decision
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Decision recorded">{report.decision ? decisionLabel(report.decision) : "Not recorded"}</Field>
          <Field label="Outcome">{report.status === "actioned" ? "Upheld" : report.status === "dismissed" ? "Dismissed" : "—"}</Field>
          <Field label="Recorded">{formatDateTime(report.resolvedAt)}</Field>
          <Field label="Recorded by">
            <IdText id={report.resolvedByUserId} label="administrator" />
          </Field>
        </dl>
        <h3 className={`${eyebrowClass} mt-4`}>Note</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray800">{report.resolutionNote ?? "No note was recorded."}</p>
        <p className="mt-3 text-sm text-gray600">A decision is final. It records what was concluded; it is not itself an action.</p>
        {followUp ? (
          <div className="mt-3">
            <Notice tone={followUp.tone} title={followUp.title}>
              {followUp.detail}
            </Notice>
          </div>
        ) : null}
      </section>
    );
  }

  const check = validateNote(note, { max });
  return (
    <section aria-labelledby="report-decision" className={cardClass}>
      <h2 id="report-decision" className="text-lg font-semibold text-gray900">
        Review and decide
      </h2>
      <p className="mt-1 text-sm text-gray600">
        Recording a decision says what you concluded. It does not remove content or suspend an account — those are
        separate actions below.
      </p>
      {actions.canStartReview ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={secondaryButton} disabled={busy} onClick={onStartReview}>
            Start review
          </button>
          <span className="text-sm text-gray600">Marks this report as under review. No decision is recorded.</span>
        </div>
      ) : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (decision && check.ok) onRequestResolve(decision, note);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {decisionOptions(capabilities).map((group) => (
            <fieldset key={group.outcome} className="rounded-lg border border-gray200 p-3">
              <legend className="px-1 text-sm font-semibold text-gray800">{group.label}</legend>
              {group.options.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray800">
                  <input
                    type="radio"
                    name="report-decision"
                    value={option.value}
                    checked={decision === option.value}
                    disabled={busy}
                    onChange={() => setDecision(option.value)}
                    className="h-4 w-4 accent-[#6d3adf]"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <ReasonField
          id="report-decision-note"
          label="Note (optional)"
          value={note}
          onChange={setNote}
          max={max}
          disabled={busy}
          hint="Recorded with the decision. Leave it empty to record none."
        />
        <button type="submit" className={primaryButton} disabled={busy || !decision || !check.ok}>
          Record decision…
        </button>
      </form>
    </section>
  );
}

/**
 * Applying an action — removing or restoring the listing, recording a suspension or reinstatement.
 * Kept apart from the decision on purpose, and every result is described from what the backend
 * answered: what was recorded, whether it is enforced, whether access is actually restricted.
 * Props: report, busy, result ({ tone, title, warning?, facts } | null), onListing(verb),
 * onAccount(verb).
 */
export function EnforcementCard({ report, busy, result, onListing, onAccount }) {
  const actions = availableReportActions(report);
  const account = accountRestrictionView(report.reported);
  return (
    <section aria-labelledby="report-actions" className={cardClass}>
      <h2 id="report-actions" className="text-lg font-semibold text-gray900">
        Apply an action
      </h2>
      <p className="mt-1 text-sm text-gray600">
        Separate from the decision. Each action needs a reason, asks for confirmation and is written to the audit history.
      </p>

      {result ? (
        <div className="mt-4" aria-live="polite">
          <Notice tone={result.tone} title={result.title}>
            {result.warning ? <p>{result.warning}</p> : null}
            <Facts facts={result.facts} />
            {result.facts?.length ? <p className="mt-2">The audit entry for this action is in the history below.</p> : null}
          </Notice>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {report.targetType === "listing" ? (
          <div className="rounded-lg border border-gray200 p-4">
            <h3 className={eyebrowClass}>Listing</h3>
            {actions.listing ? (
              <>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray800">
                  <span className="font-medium">{report.target.title}</span>
                  <Badge tone={actions.listing.status === "removed" ? "danger" : "neutral"}>{listingStatusLabel(actions.listing.status)}</Badge>
                </p>
                <div className="mt-3">
                  {actions.listing.canRemove ? (
                    <button type="button" className={secondaryButton} disabled={busy} onClick={() => onListing("remove")}>
                      Remove listing…
                    </button>
                  ) : null}
                  {actions.listing.canRestore ? (
                    <button type="button" className={secondaryButton} disabled={busy} onClick={() => onListing("restore")}>
                      Restore listing…
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray700">The reported listing no longer exists, so there is nothing to remove.</p>
            )}
          </div>
        ) : null}

        <div className="rounded-lg border border-gray200 p-4">
          <h3 className={eyebrowClass}>Reported account</h3>
          <p className="mt-2">
            <Badge tone={account.tone}>{account.label}</Badge>
          </p>
          {account.detail ? <p className="mt-1 text-sm text-gray600">{account.detail}</p> : null}
          {actions.account ? (
            <div className="mt-3">
              {actions.account.canSuspend ? (
                <button type="button" className={secondaryButton} disabled={busy} onClick={() => onAccount("suspend")}>
                  Record suspension…
                </button>
              ) : null}
              {actions.account.canReinstate ? (
                <button type="button" className={secondaryButton} disabled={busy} onClick={() => onAccount("reinstate")}>
                  Reinstate account…
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray700">There is no account to suspend or reinstate.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Props: report. */
export function HistoryCard({ report }) {
  return (
    <section aria-labelledby="report-history" className={cardClass}>
      <h2 id="report-history" className="text-lg font-semibold text-gray900">
        Moderation history
      </h2>
      <p className="mt-1 text-sm text-gray600">Read-only. Entries cannot be changed or removed.</p>
      <div className="mt-3">
        <HistoryList history={report.history} />
      </div>
    </section>
  );
}
