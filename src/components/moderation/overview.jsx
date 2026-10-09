/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { Link } from "react-router-dom";
import { RecentActivity } from "./auditViews";
import { CapabilityPanel, EnforcementNotice, ReportingNotice } from "./capabilityPanel";
import { cardClass, eyebrowClass, linkClass, primaryButton, secondaryButton } from "./styles";
import { ErrorState, LoadingRows } from "./ui";

// The four counts, in the order a report moves through them. Each is the queue's own
// `meta.itemCount` for that status — there is no separate analytics request.
const COUNTS = [
  { status: "open", label: "Open", context: "Report received, not yet reviewed" },
  { status: "in_review", label: "Under review", context: "Review started, no decision yet" },
  { status: "actioned", label: "Actioned", context: "Decision recorded: upheld" },
  { status: "dismissed", label: "Dismissed", context: "Decision recorded: dismissed" },
];

/**
 * The moderation overview. Props: loading, overview (loadOverview's result, or null before the
 * first answer), onRetry().
 *
 * ⚠️ WHILE REPORTING IS OFF, ZERO MEANS "NOTHING COULD BE FILED". The notice at the top says so, so
 * four zeroes are never read as "no policy violations".
 */
export function OverviewBody({ loading, overview, onRetry }) {
  if (!overview) return <LoadingRows label="Loading the moderation overview…" rows={5} />;
  const blocked = overview.error && (overview.error.kind === "forbidden" || overview.error.kind === "session");
  if (blocked) return <ErrorState error={overview.error} />;

  return (
    <div className="space-y-6" aria-busy={loading}>
      {overview.error ? <ErrorState error={overview.error} onRetry={onRetry} /> : null}
      <ReportingNotice capabilities={overview.capabilities} />
      <EnforcementNotice capabilities={overview.capabilities} />

      <section aria-label="Report counts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COUNTS.map(({ status, label, context }) => {
          const count = overview.counts?.[status];
          return (
            <Link
              key={status}
              to={`/moderation/reports?status=${status}`}
              className="rounded-xl border border-gray200 bg-white p-4 shadow-sm transition hover:border-[#8a5cf6] focus:outline-none focus:ring-4 focus:ring-[#ede7ff]"
            >
              <p className={eyebrowClass}>{label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-gray900">{count === null || count === undefined ? "—" : count}</p>
              <p className="mt-1 text-xs text-gray500">{context}</p>
            </Link>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/moderation/reports" className={primaryButton}>
          Open the reports queue
        </Link>
        <Link to="/moderation/audit" className={secondaryButton}>
          Open audit history
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="recent-moderation-activity" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-moderation-activity" className="text-lg font-semibold text-gray900">
              Recent moderation activity
            </h2>
            <Link to="/moderation/audit" className={linkClass}>
              All history
            </Link>
          </div>
          <div className="mt-3">
            <RecentActivity actions={overview.recent} />
          </div>
        </section>
        <CapabilityPanel capabilities={overview.capabilities} />
      </div>
    </div>
  );
}
