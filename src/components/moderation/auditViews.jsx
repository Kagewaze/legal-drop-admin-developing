/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { PAGE_SIZES, auditRowView, formatDateTime, subjectTypeLabel } from "../../utils/moderation";
import {
  cellClass,
  controlClass,
  headCellClass,
  labelClass,
  linkClass,
  primaryButton,
  secondaryButton,
  tableClass,
  tableWrapClass,
} from "./styles";
import { EmptyState, ErrorState, IdText, LoadingRows, Notice, Pager } from "./ui";

/**
 * The audit trail's filters, exactly the ones `GET actions` supports.
 * Props: subjectTypes, draft, errors, busy, onChange(field, value), onApply(), onClear().
 */
export function AuditFilters({ subjectTypes, draft, errors = {}, busy = false, onChange, onApply, onClear }) {
  const idField = (field, label) => (
    <div>
      <label htmlFor={`audit-filter-${field}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`audit-filter-${field}`}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={draft[field]}
        disabled={busy}
        placeholder="Full ID"
        aria-invalid={Boolean(errors[field])}
        aria-describedby={errors[field] ? `audit-filter-${field}-error` : undefined}
        onChange={(event) => onChange(field, event.target.value)}
        className={`${controlClass} mt-1 font-mono text-xs`}
      />
      {errors[field] ? (
        <p id={`audit-filter-${field}-error`} className="mt-1 text-xs font-medium text-rose-700">
          {errors[field]}
        </p>
      ) : null}
    </div>
  );
  const choice = (field, label, options) => (
    <div>
      <label htmlFor={`audit-filter-${field}`} className={labelClass}>
        {label}
      </label>
      <select
        id={`audit-filter-${field}`}
        value={String(draft[field])}
        disabled={busy}
        onChange={(event) => onChange(field, field === "limit" ? Number(event.target.value) : event.target.value)}
        className={`${controlClass} mt-1`}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form
      aria-label="Filter audit history"
      className="rounded-xl border border-gray200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {choice("subjectType", "Subject", [["", "All"], ...subjectTypes.map((value) => [value, subjectTypeLabel(value)])])}
        {idField("subjectId", "Subject ID")}
        {idField("reportId", "Report ID")}
        {idField("actorUserId", "Administrator ID")}
        {choice("order", "Order", [
          ["DESC", "Newest first"],
          ["ASC", "Oldest first"],
        ])}
        {choice("limit", "Rows per page", PAGE_SIZES.map((size) => [String(size), String(size)]))}
        <div className="flex items-end gap-2">
          <button type="submit" className={primaryButton} disabled={busy}>
            Apply filters
          </button>
          <button type="button" className={secondaryButton} disabled={busy} onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * The audit trail. ⚠️ IMMUTABLE AND SHOWN THAT WAY: there is no control here that edits or removes
 * a row. A row's free-text reason is not printed in the table; it is opened on request, one row at
 * a time, so a list of rows never becomes a page of report details.
 * Props: actions (the route's `data`).
 */
export function AuditTable({ actions }) {
  const [open, setOpen] = useState(null);
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <caption className="sr-only">Moderation audit history. Entries cannot be changed or removed.</caption>
        <thead className="bg-gray50">
          <tr>
            <th scope="col" className={headCellClass}>When</th>
            <th scope="col" className={headCellClass}>Action</th>
            <th scope="col" className={headCellClass}>Administrator</th>
            <th scope="col" className={headCellClass}>Subject</th>
            <th scope="col" className={headCellClass}>Report</th>
            <th scope="col" className={headCellClass}>Outcome</th>
            <th scope="col" className={headCellClass}>Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray100">
          {actions.map((action) => {
            const row = auditRowView(action);
            const expanded = open === row.id;
            return (
              <Fragment key={row.id}>
                <tr>
                  <td className={`${cellClass} whitespace-nowrap`}>{formatDateTime(row.when)}</td>
                  <td className={`${cellClass} font-medium text-gray900`}>{row.actionLabel}</td>
                  <td className={cellClass}>
                    <IdText id={row.actorId} label="administrator" />
                  </td>
                  <td className={cellClass}>
                    <span className="block">{row.subjectLabel}</span>
                    <IdText id={row.subjectId} label="subject" />
                  </td>
                  <td className={cellClass}>
                    {row.reportId ? (
                      <Link to={`/moderation/reports/${row.reportId}`} className={linkClass} aria-label={`Open report ${row.reportId}`}>
                        Open report
                      </Link>
                    ) : (
                      <span className="text-gray500">—</span>
                    )}
                  </td>
                  <td className={cellClass}>{row.details || <span className="text-gray500">—</span>}</td>
                  <td className={cellClass}>
                    {row.hasNote ? (
                      <button
                        type="button"
                        className={linkClass}
                        aria-expanded={expanded}
                        aria-controls={`audit-reason-${row.id}`}
                        onClick={() => setOpen(expanded ? null : row.id)}
                      >
                        {expanded ? "Hide reason" : "Show reason"}
                      </button>
                    ) : (
                      <span className="text-gray500">None recorded</span>
                    )}
                  </td>
                </tr>
                {expanded ? (
                  <tr id={`audit-reason-${row.id}`} className="bg-gray50">
                    <td colSpan={7} className="px-3 py-3 text-sm text-gray800">
                      <span className="font-semibold">Recorded reason: </span>
                      <span className="whitespace-pre-wrap break-words">{action.note}</span>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A report's own history, oldest first, as a read-only timeline.
 * Props: history (the report's `history`), emptyText.
 */
export function HistoryList({ history, emptyText = "No moderation action has been recorded for this report." }) {
  if (!history?.length) return <p className="text-sm text-gray600">{emptyText}</p>;
  return (
    <ol className="divide-y divide-gray100">
      {history.map((action) => {
        const row = auditRowView(action);
        return (
          <li key={row.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-gray900">{row.actionLabel}</span>
              <span className="text-gray500">{formatDateTime(row.when)}</span>
              <span className="inline-flex items-center gap-1 text-gray600">
                by <IdText id={row.actorId} label="administrator" />
              </span>
            </div>
            {row.details ? <p className="mt-1 text-gray700">{row.details}</p> : null}
            {row.hasNote ? <p className="mt-1 whitespace-pre-wrap break-words text-gray700">Reason: {action.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The latest audit entries for the overview: what happened, when and to what. No reasons and no
 * report content — those are read on the report or opened in the audit history.
 * Props: actions.
 */
export function RecentActivity({ actions }) {
  if (!actions?.length) return <p className="text-sm text-gray600">No moderation action has been recorded yet.</p>;
  return (
    <ul className="divide-y divide-gray100">
      {actions.map((action) => {
        const row = auditRowView(action);
        return (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span>
              <span className="font-semibold text-gray900">{row.actionLabel}</span>
              <span className="ml-2 text-gray600">{row.subjectLabel}</span>
            </span>
            <span className="flex items-center gap-3 text-gray500">
              {formatDateTime(row.when)}
              {row.reportId ? (
                <Link to={`/moderation/reports/${row.reportId}`} className={linkClass} aria-label={`Open report ${row.reportId}`}>
                  Open report
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The audit trail's body in every state. Props: loading, result, filtersActive, onRetry(),
 * onPage(pageNumber).
 */
export function AuditBody({ loading, result, filtersActive, onRetry, onPage }) {
  if (!result) return <LoadingRows label="Loading audit history…" rows={6} />;
  if (!result.ok) {
    if (result.error.kind === "invalid" && result.error.fields) {
      return (
        <Notice tone="warning" title="Correct the highlighted filters">
          Nothing was requested.
        </Notice>
      );
    }
    return <ErrorState error={result.error} onRetry={onRetry} />;
  }
  const actions = Array.isArray(result.data) ? result.data : [];
  if (actions.length === 0) {
    return filtersActive ? (
      <EmptyState title="No audit entries match these filters">Change or clear the filters to see other entries.</EmptyState>
    ) : (
      <EmptyState title="No moderation action has been recorded yet">
        Reviews, decisions, listing removals, suspensions and evidence viewings appear here as they happen.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3" aria-busy={loading}>
      <AuditTable actions={actions} />
      <Pager meta={result.meta} onPage={onPage} label="Audit history pages" />
    </div>
  );
}
