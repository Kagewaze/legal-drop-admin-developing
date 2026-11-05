/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
// The payout monitor's views. Presentational and read-only: they render what the API returned and offer no control that
// changes anything — no transfer, no status change, no switch. Built from the moderation screens' primitives.
import { Badge, EmptyState, ErrorState, IdText, LoadingRows, Notice, Pager } from "../moderation/ui";
import { cardClass, cellClass, controlClass, headCellClass, labelClass, secondaryButton, tableWrapClass } from "../moderation/styles";
import { driverName, formatCad, toMinor } from "../../utils/payoutPayments";
import {
  MONITOR_STATUSES,
  QUEUE_LIMIT,
  REVIEW_LIMIT,
  attentionItems,
  codeLabel,
  domainLabel,
  evidenceIndicator,
  money,
  queueEntryView,
  transferRunView,
  when,
} from "../../utils/payoutMonitor";
import { PayoutStatusBadge } from "./payoutEvidence";

const STATUS_NAMES = { pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed" };
const TABS = [
  { id: "payouts", label: "Payouts" },
  { id: "runs", label: "Transfer runs" },
  { id: "queue", label: "Funding queue" },
  { id: "exceptions", label: "Exceptions" },
];
const ACCENTS = {
  danger: "border-l-rose-500",
  warning: "border-l-amber-500",
  success: "border-l-emerald-500",
  info: "border-l-[#6d3adf]",
  neutral: "border-l-gray300",
};
const smallButton =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray700 transition hover:border-[#8a5cf6] hover:bg-[#f8f5ff] hover:text-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#ede7ff]";

function Table({ caption, headings, minWidth = "min-w-[880px]", children }) {
  return (
    <div className={tableWrapClass}>
      <table className={`w-full ${minWidth} text-left text-sm`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray50">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className={headCellClass}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray100">{children}</tbody>
      </table>
    </div>
  );
}

/** One read's three states, then its content. Props: part ({ loading, error, value }), label, onRetry, isEmpty, emptyTitle, emptyText, children(value). */
function Loaded({ part, label, onRetry, isEmpty, emptyTitle, emptyText, children }) {
  if (part.error) return <ErrorState error={part.error} onRetry={onRetry} />;
  if (part.value === null || part.value === undefined) return <LoadingRows label={label} rows={3} />;
  if (isEmpty(part.value)) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return children(part.value);
}

function Stat({ label, children }) {
  return (
    <div className="rounded-lg border border-gray200 bg-gray50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray900">{children}</dd>
    </div>
  );
}

function AttentionCards({ items }) {
  return (
    <section aria-labelledby="monitor-attention" className="space-y-3">
      <h2 id="monitor-attention" className="text-base font-semibold text-gray900">
        Needs attention
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.key} className={`rounded-xl border border-l-4 border-gray200 bg-white p-4 shadow-sm ${ACCENTS[item.tone] ?? ACCENTS.neutral}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray500">{item.title}</p>
            <p className="mt-1 text-2xl font-semibold text-gray900">{item.value}</p>
            <p className="mt-1 text-xs text-gray600">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusCounts({ counts, active, onPick }) {
  const value = counts.value ?? {};
  const tiles = [{ status: "", label: "All driver payouts" }, ...MONITOR_STATUSES.map((status) => ({ status, label: STATUS_NAMES[status] }))];
  return (
    <section aria-label="Driver payouts by status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const count = tile.status ? value[tile.status] : value.all;
        const selected = active === tile.status;
        return (
          <button
            key={tile.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(tile.status)}
            className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-[#ede7ff] ${
              selected ? "border-[#6d3adf] bg-[#faf8ff]" : "border-gray200 bg-white hover:border-[#8a5cf6]"
            }`}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray500">{tile.label}</span>
            <span className="mt-1 block text-2xl font-semibold text-gray900">{Number.isInteger(count) ? count : counts.loading ? "…" : "—"}</span>
          </button>
        );
      })}
    </section>
  );
}

function Tabs({ active, onTab }) {
  return (
    <div role="tablist" aria-label="Payout monitor sections" className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`monitor-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls="monitor-panel"
          onClick={() => onTab(tab.id)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#ede7ff] ${
            active === tab.id ? "border-[#6d3adf] bg-[#6d3adf] text-white" : "border-gray300 bg-white text-gray700 hover:border-[#8a5cf6] hover:text-[#5b2bc4]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PayoutsPanel({ monitor, onView }) {
  const { list, evidence, filters, setFilter, clearFilters, refresh } = monitor;
  const rows = Array.isArray(list.value?.data) ? list.value.data : [];
  const filtered = filters.status !== "" || filters.order !== "DESC";
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="monitor-status" className={labelClass}>
            Status
          </label>
          <select id="monitor-status" value={filters.status} onChange={(event) => setFilter({ status: event.target.value })} className={`${controlClass} mt-1.5 sm:w-56`}>
            <option value="">All statuses</option>
            {MONITOR_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_NAMES[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="monitor-order" className={labelClass}>
            Order
          </label>
          <select id="monitor-order" value={filters.order} onChange={(event) => setFilter({ order: event.target.value })} className={`${controlClass} mt-1.5 sm:w-44`}>
            <option value="DESC">Newest first</option>
            <option value="ASC">Oldest first</option>
          </select>
        </div>
        {filtered ? (
          <button type="button" className={secondaryButton} onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={refresh} /> : null}
      {!list.error && !rows.length && list.loading ? <LoadingRows label="Loading payouts…" rows={5} /> : null}
      {!list.error && !rows.length && !list.loading ? (
        <EmptyState title="No payouts match">{filtered ? "Clear the filters to see every driver payout." : "No driver payout exists yet."}</EmptyState>
      ) : null}
      {!list.error && rows.length ? (
        <Table caption="Driver payouts and what is recorded as paid" headings={["Payout", "Driver", "Amount", "Status", "Payment on record", "Created", "Details"]} minWidth="min-w-[1000px]">
          {rows.map((payout) => {
            const indicator = evidenceIndicator(payout, evidence[payout.id]);
            return (
              <tr key={payout.id} className="bg-white">
                <td className={cellClass}>
                  <IdText id={payout.id} label="payout" />
                </td>
                <td className={cellClass}>
                  <p className="font-semibold text-gray900">{driverName(payout.driver)}</p>
                  <p className="text-xs text-gray500">{payout.driver?.email}</p>
                </td>
                <td className={`${cellClass} whitespace-nowrap font-semibold text-gray900`}>{formatCad(toMinor(payout.amount))}</td>
                <td className={cellClass}>
                  <PayoutStatusBadge payout={payout} />
                </td>
                <td className={cellClass}>
                  <Badge tone={indicator.tone}>{indicator.label}</Badge>
                  {indicator.detail ? <p className="mt-1 max-w-xs text-xs text-gray500">{indicator.detail}</p> : null}
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>{when(payout.createdAt)}</td>
                <td className={cellClass}>
                  <button type="button" className={smallButton} onClick={() => onView(payout.id)}>
                    View details
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      ) : null}
      <Pager meta={list.value?.meta} onPage={(page) => setFilter({ page })} label="Payout pages" />
    </div>
  );
}

function RunCard({ run }) {
  const view = transferRunView(run);
  const times = [
    `Started ${when(run.startedAt)}`,
    run.finishedAt ? `finished ${when(run.finishedAt)}` : null,
    run.interruptedAt ? `interrupted ${when(run.interruptedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={`${cardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray900">{view.trigger}</p>
          <p className="mt-0.5 text-xs text-gray500">{times}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={view.status.tone}>{view.status.label}</Badge>
          <Badge tone={view.alert.tone}>{view.alert.label}</Badge>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Payouts considered">{run.candidateCount ?? "—"}</Stat>
        <Stat label="Deferred for funding">{`${run.deferredCount ?? "—"} · ${formatCad(view.deferredMinor)}`}</Stat>
        <Stat label="Driver batches not built">{view.claimFailures}</Stat>
        <Stat label="Run">
          <IdText id={run.id} label="run" />
        </Stat>
      </dl>
      {view.counts.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Outcomes in this run">
          {view.counts.map((item) => (
            <Badge key={item.code} tone="neutral">{`${item.label}: ${item.count}`}</Badge>
          ))}
        </div>
      ) : null}
      {view.payouts.length ? (
        <details className="rounded-lg border border-gray200 bg-gray50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray700">{`Payouts in this run (${view.payouts.length})`}</summary>
          <div className="mt-3">
            <Table caption="Each payout's outcome in this run" headings={["Payout", "Programme", "Amount", "Outcome", "Detail"]} minWidth="min-w-[720px]">
              {view.payouts.map((item, index) => (
                <tr key={`${item.domain}:${item.payoutId}:${index}`} className="bg-white">
                  <td className={cellClass}>
                    <IdText id={item.payoutId} label="payout" />
                  </td>
                  <td className={cellClass}>{domainLabel(item.domain)}</td>
                  <td className={`${cellClass} whitespace-nowrap`}>{money(item.amountMinor)}</td>
                  <td className={cellClass}>{codeLabel(item.outcome)}</td>
                  <td className={`${cellClass} text-xs text-gray600`}>
                    {typeof item.action === "string" ? item.action : item.failureCategory ? codeLabel(item.failureCategory) : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </details>
      ) : null}
    </li>
  );
}

function FundingQueuePanel({ queue, onRetry }) {
  return (
    <Loaded
      part={queue}
      label="Loading the funding queue…"
      onRetry={onRetry}
      isEmpty={(rows) => !rows.length}
      emptyTitle="Nothing is waiting for funding"
      emptyText="No payout of any programme is deferred for funding."
    >
      {(rows) => (
        <div className="space-y-3">
          <p className="text-sm text-gray600">
            Payouts of every programme deferred for funding, oldest due first. Over 7 days past due is overdue; over 14 is urgent.
          </p>
          {rows.length >= QUEUE_LIMIT ? <Notice tone="info">{`Showing the first ${QUEUE_LIMIT}.`}</Notice> : null}
          <Table caption="Payouts waiting for funding" headings={["Payout", "Programme", "Amount", "Due", "Waiting", "Reason", "Deferrals", "Next retry"]} minWidth="min-w-[1040px]">
            {rows.map((entry) => {
              const state = queueEntryView(entry);
              return (
                <tr key={`${entry.domain}:${entry.payoutId}`} className="bg-white">
                  <td className={cellClass}>
                    <IdText id={entry.payoutId} label="payout" />
                  </td>
                  <td className={cellClass}>{domainLabel(entry.domain)}</td>
                  <td className={`${cellClass} whitespace-nowrap font-semibold text-gray900`}>
                    {money(entry.amountMinor)}
                    {entry.livemode === false ? (
                      <span className="ml-2">
                        <Badge tone="neutral">Test mode</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className={`${cellClass} whitespace-nowrap`}>{when(entry.dueAt)}</td>
                  <td className={cellClass}>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {Number.isInteger(entry.ageDays) ? <p className="mt-1 text-xs text-gray500">{`${entry.ageDays} days`}</p> : null}
                  </td>
                  <td className={cellClass}>{codeLabel(entry.reason)}</td>
                  <td className={cellClass}>{entry.deferralCount ?? "—"}</td>
                  <td className={`${cellClass} whitespace-nowrap`}>{when(entry.nextRetryAt)}</td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}
    </Loaded>
  );
}

function ExceptionsPanel({ unevidenced, legacy, onRetry }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="monitor-unevidenced" className="space-y-3">
        <div>
          <h3 id="monitor-unevidenced" className="text-base font-semibold text-gray900">
            Completed without payment evidence
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-gray600">
            Driver and marketplace-seller payouts marked completed with no Stripe transfer and no recorded settlement, from before
            evidence was required. They may have been paid by hand, or not at all: reconcile each against bank and Stripe records.
          </p>
        </div>
        <Loaded
          part={unevidenced}
          label="Loading unevidenced completions…"
          onRetry={onRetry}
          isEmpty={(value) => !value.payouts?.length}
          emptyTitle="None found"
          emptyText="Every completed driver and seller payout has a Stripe transfer or a recorded settlement."
        >
          {(value) => (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray700">
                {`${value.total} in all · ${money(value.amountMinor)} · ${value.byDomain?.DRIVER ?? 0} driver, ${value.byDomain?.MARKETPLACE_SELLER ?? 0} seller${
                  value.total > value.payouts.length ? ` · showing the first ${value.payouts.length}` : ""
                }`}
              </p>
              <Table caption="Completed payouts without payment evidence" headings={["Payout", "Programme", "Amount", "Created", "Record"]} minWidth="min-w-[720px]">
                {value.payouts.map((item) => (
                  <tr key={`${item.domain}:${item.payoutId}`} className="bg-white">
                    <td className={cellClass}>
                      <IdText id={item.payoutId} label="payout" />
                    </td>
                    <td className={cellClass}>{domainLabel(item.domain)}</td>
                    <td className={`${cellClass} whitespace-nowrap font-semibold text-gray900`}>{money(item.amountMinor)}</td>
                    <td className={`${cellClass} whitespace-nowrap`}>{when(item.createdAt)}</td>
                    <td className={cellClass}>{item.deleted ? <Badge tone="neutral">Deleted</Badge> : "—"}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Loaded>
      </section>
      <section aria-labelledby="monitor-legacy" className="space-y-3">
        <div>
          <h3 id="monitor-legacy" className="text-base font-semibold text-gray900">
            Legacy payouts awaiting review
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-gray600">
            Historical payouts the backend lists for an operator&apos;s review before any transfer can pay them. Reviews are not made here.
          </p>
        </div>
        <Loaded
          part={legacy}
          label="Loading legacy payouts…"
          onRetry={onRetry}
          isEmpty={(rows) => !rows.length}
          emptyTitle="None waiting"
          emptyText="No historical payout is waiting for review."
        >
          {(rows) => (
            <div className="space-y-3">
              {rows.length >= REVIEW_LIMIT ? <Notice tone="info">{`Showing the first ${REVIEW_LIMIT}.`}</Notice> : null}
              <Table caption="Legacy payouts awaiting review" headings={["Payout", "Programme", "Status", "Amount", "Stripe transfer", "Review"]} minWidth="min-w-[820px]">
                {rows.map((item) => (
                  <tr key={`${item.domain}:${item.payoutId}`} className="bg-white">
                    <td className={cellClass}>
                      <IdText id={item.payoutId} label="payout" />
                    </td>
                    <td className={cellClass}>{domainLabel(item.domain)}</td>
                    <td className={cellClass}>
                      {codeLabel(item.payoutStatus)}
                      {item.deleted ? (
                        <span className="ml-2">
                          <Badge tone="neutral">Deleted</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className={`${cellClass} whitespace-nowrap font-semibold text-gray900`}>{money(item.amountMinor)}</td>
                    <td className={cellClass}>{item.hasRecordedTransfer ? <Badge tone="warning">Transfer recorded</Badge> : "None recorded"}</td>
                    <td className={cellClass}>{codeLabel(item.state)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Loaded>
      </section>
    </div>
  );
}

/**
 * The read-only payout monitor. Props: monitor (usePayoutMonitor's value), tab, onTab(tabId), onView(payoutId) — opens the
 * read-only payout details.
 */
export function PayoutMonitorView({ monitor, tab, onTab, onView }) {
  const busy = [monitor.list, monitor.counts, monitor.runs, monitor.queue, monitor.unevidenced, monitor.legacy].some((part) => part.loading);
  return (
    <main className="min-h-screen bg-gray50 px-4 py-6 text-gray900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-gray200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6d3adf]">Druppr operations · Payouts</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray900 sm:text-3xl">Payout monitor</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray600">
              Payout status, what is recorded as paid, the weekly transfer runs, the funding queue and the exceptions that need a person.
              Read-only: nothing here sends money or changes a payout.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="info">Read-only</Badge>
            <button type="button" className={secondaryButton} onClick={monitor.refresh} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>
        <AttentionCards items={attentionItems(monitor)} />
        <StatusCounts
          counts={monitor.counts}
          active={monitor.filters.status}
          onPick={(status) => {
            monitor.setFilter({ status });
            onTab("payouts");
          }}
        />
        <Tabs active={tab} onTab={onTab} />
        <section id="monitor-panel" role="tabpanel" aria-labelledby={`monitor-tab-${tab}`}>
          {tab === "runs" ? (
            <Loaded
              part={monitor.runs}
              label="Loading transfer runs…"
              onRetry={monitor.refresh}
              isEmpty={(rows) => !rows.length}
              emptyTitle="No transfer run recorded"
              emptyText="No weekly transfer pass has been recorded."
            >
              {(rows) => (
                <ol className="space-y-3">
                  {rows.map((run) => (
                    <RunCard key={run.id} run={run} />
                  ))}
                </ol>
              )}
            </Loaded>
          ) : tab === "queue" ? (
            <FundingQueuePanel queue={monitor.queue} onRetry={monitor.refresh} />
          ) : tab === "exceptions" ? (
            <ExceptionsPanel unevidenced={monitor.unevidenced} legacy={monitor.legacy} onRetry={monitor.refresh} />
          ) : (
            <PayoutsPanel monitor={monitor} onView={onView} />
          )}
        </section>
      </div>
    </main>
  );
}
