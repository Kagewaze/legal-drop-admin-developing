/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AccountActionDialog, ListingActionDialog, ResolveDialog } from "../components/moderation/actionDialogs";
import { moderationApi } from "../components/moderation/api";
import { EnforcementNotice } from "../components/moderation/capabilityPanel";
import { ConversationEvidence } from "../components/moderation/conversationEvidence";
import {
  AccountsCard,
  AllegationCard,
  DecisionCard,
  EnforcementCard,
  EvidenceSnapshotCard,
  HistoryCard,
  ReportStatus,
} from "../components/moderation/reportDetail";
import { eyebrowClass, linkClass } from "../components/moderation/styles";
import { ErrorState, LoadingRows, ModerationPage, Notice } from "../components/moderation/ui";
import { useLoader } from "../components/moderation/useLoader";
import {
  NOTE_MAX_LENGTH,
  availableReportActions,
  decisionLabel,
  describeAccountActionResult,
  describeListingActionResult,
  inDialogError,
  mutationFailureNotice,
} from "../utils/moderation";
import { runMutation } from "../utils/moderationApi";

/** /moderation/reports/:reportId. A different report is a different screen, with nothing carried over. */
export function ModerationReport() {
  const { reportId } = useParams();
  return <ReportScreen key={reportId} reportId={reportId} />;
}

/**
 * One report: the allegation, the accounts, the evidence, the decision, the actions, the history.
 *
 * ⚠️ NOTHING SENSITIVE IS FETCHED UNTIL THIS SCREEN IS OPEN, AND NOTHING IS KEPT WHEN IT CLOSES.
 * The report is requested once the administrator has navigated here (never from the queue, a hover
 * or a prefetch), it lives in this component's state, and it is neither logged nor written to
 * browser storage. The private conversation is not requested at all until it is asked for.
 *
 * ⚠️ EVERY WRITE RELOADS THE REPORT, success or not (runMutation), so what is on screen afterwards
 * is the backend's state and not this page's assumption.
 */
function ReportScreen({ reportId }) {
  const loadReport = useCallback(() => moderationApi.getReport(reportId), [reportId]);
  const detail = useLoader(loadReport);
  const loadCapabilities = useCallback(() => moderationApi.getCapabilities(), []);
  const capabilities = useLoader(loadCapabilities);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [dialog, setDialog] = useState(null);
  const working = useRef(false);

  const report = detail.value?.ok ? detail.value.data : null;
  const loadError = detail.value && !detail.value.ok ? detail.value.error : null;
  const known = capabilities.value?.ok ? capabilities.value.data : null;
  const noteMax = known?.limits?.noteMaxLength ?? NOTE_MAX_LENGTH;
  const refreshReport = detail.refresh;

  /** One confirmation → one request. A second trigger while one is in flight does nothing. */
  async function mutate(request) {
    if (working.current) return null;
    working.current = true;
    setBusy(true);
    try {
      return await runMutation(request, refreshReport);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  /** After a failed write: the refusal stays in the confirmation, or the page says what happened. */
  function settle(action, outcome, onSuccess) {
    if (!outcome) return;
    if (outcome.ok) {
      setDialog(null);
      onSuccess(outcome);
      return;
    }
    // Only a confirmation that is open can show a refusal in place.
    const inPlace = dialog ? inDialogError(action, outcome.error) : "";
    if (inPlace) {
      setDialog((current) => (current ? { ...current, error: inPlace } : current));
      return;
    }
    setDialog(null);
    setNotice(mutationFailureNotice(outcome.error, { resolving: action === "resolve" || action === "review" }));
  }

  async function startReview() {
    setNotice(null);
    const outcome = await mutate(() => moderationApi.startReview(reportId));
    settle("review", outcome, () =>
      setNotice({ tone: "success", title: "Review started", detail: "This report is now under review. No decision has been recorded." })
    );
  }

  async function resolve() {
    const { decision, note } = dialog;
    const outcome = await mutate(() => moderationApi.resolveReport(reportId, decision, note));
    settle("resolve", outcome, () =>
      setNotice({
        tone: "success",
        title: `Decision recorded: ${decisionLabel(decision)}`,
        // ⚠️ Says what was recorded, and nothing about content or accounts: those are separate.
        detail: "The decision is recorded. It did not remove content or suspend an account; use “Apply an action” for that.",
      })
    );
  }

  async function moderateListing(reason) {
    const { verb } = dialog;
    const listing = availableReportActions(report).listing;
    // The listing can disappear between opening the confirmation and confirming it.
    if (!listing) {
      setDialog(null);
      return;
    }
    const send = verb === "remove" ? moderationApi.removeListing : moderationApi.restoreListing;
    const outcome = await mutate(() => send(listing.kind, listing.id, reason, reportId));
    settle("listing", outcome, (answer) => setActionResult(describeListingActionResult(verb, answer.data)));
  }

  async function moderateAccount(reason) {
    const { verb } = dialog;
    const send = verb === "suspend" ? moderationApi.suspendAccount : moderationApi.reinstateAccount;
    const outcome = await mutate(() => send(report.reportedUserId, reason, reportId));
    // The result is described from the answer's own `enforced` and `accessRestricted`.
    settle("account", outcome, (answer) => setActionResult(describeAccountActionResult(verb, answer.data)));
  }

  function open(next) {
    setNotice(null);
    setActionResult(null);
    setDialog({ ...next, error: "" });
    // The confirmation must describe what will happen NOW, so the enforcement state is re-read.
    if (next.kind === "account") capabilities.refresh();
  }

  return (
    <ModerationPage
      title="Report"
      description="An allegation to review. Nothing here is a finding until a decision is recorded, and a decision is not itself an action."
      aside={report ? <ReportStatus report={report} /> : null}
    >
      <p>
        <Link to="/moderation/reports" className={linkClass}>
          ← Back to reports
        </Link>
      </p>

      {!detail.value ? <LoadingRows label="Loading the report…" rows={6} /> : null}
      {loadError ? <ErrorState error={loadError} onRetry={refreshReport} /> : null}

      <div aria-live="polite">
        {notice ? (
          <Notice tone={notice.tone} title={notice.title}>
            {notice.detail}
          </Notice>
        ) : null}
      </div>

      {report ? (
        <div className="space-y-6" aria-busy={detail.loading || busy}>
          <p className={eyebrowClass}>1 · What was reported</p>
          <AllegationCard report={report} />
          <AccountsCard report={report} />
          <EvidenceSnapshotCard report={report} />
          {report.targetType === "message" ? (
            <ConversationEvidence
              report={report}
              api={moderationApi}
              onViewed={refreshReport}
              contextWindow={known?.limits?.evidenceContextWindow ?? 10}
            />
          ) : null}

          <p className={eyebrowClass}>2 · Decide</p>
          <DecisionCard
            report={report}
            capabilities={known}
            busy={busy}
            onStartReview={startReview}
            onRequestResolve={(decision, note) => open({ kind: "resolve", decision, note })}
          />

          <p className={eyebrowClass}>3 · Apply</p>
          <EnforcementNotice capabilities={known} />
          <EnforcementCard
            report={report}
            busy={busy}
            result={actionResult}
            onListing={(verb) => open({ kind: "listing", verb })}
            onAccount={(verb) => open({ kind: "account", verb })}
          />

          <p className={eyebrowClass}>History</p>
          <HistoryCard report={report} />
        </div>
      ) : null}

      {dialog?.kind === "resolve" ? (
        <ResolveDialog
          decision={dialog.decision}
          note={dialog.note}
          busy={busy}
          error={dialog.error}
          onConfirm={resolve}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "listing" && report ? (
        <ListingActionDialog
          verb={dialog.verb}
          status={report.target?.status}
          max={noteMax}
          busy={busy}
          error={dialog.error}
          onConfirm={moderateListing}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "account" ? (
        <AccountActionDialog
          verb={dialog.verb}
          capabilities={known}
          max={noteMax}
          busy={busy}
          error={dialog.error}
          onConfirm={moderateAccount}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </ModerationPage>
  );
}
