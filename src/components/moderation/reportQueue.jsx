/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { Link } from "react-router-dom";
import {
  PAGE_SIZES,
  formatDateTime,
  reasonLabel,
  reportingInactiveNotice,
  reportStage,
  reportStatusLabel,
  targetKindLabel,
  targetTypeLabel,
} from "../../utils/moderation";
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
import { Badge, EmptyState, ErrorState, IdText, LoadingRows, Notice, Pager } from "./ui";

const nextStep = (status) => (status === "open" ? "Review" : status === "in_review" ? "Continue review" : "View");

function Choice({ id, label, value, onChange, options, disabled }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${controlClass} mt-1`}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function IdInput({ id, label, value, onChange, error, disabled }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        placeholder="Full ID"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClass} mt-1 font-mono text-xs`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The queue's filters, exactly the ones `GET reports` supports.
 * Props: vocabulary ({ statuses, reasons, targetTypes }), draft (the form's values), errors
 * ({ field: message }), busy, onChange(field, value), onApply(), onClear().
 */
export function ReportFilters({ vocabulary, draft, errors = {}, busy = false, onChange, onApply, onClear }) {
  const all = (values, label) => [["", "All"], ...values.map((value) => [value, label(value)])];
  return (
    <form
      aria-label="Filter reports"
      className="rounded-xl border border-gray200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Choice id="report-filter-status" label="Status" value={draft.status} disabled={busy} onChange={(value) => onChange("status", value)} options={all(vocabulary.statuses, reportStatusLabel)} />
        <Choice id="report-filter-target" label="Target type" value={draft.targetType} disabled={busy} onChange={(value) => onChange("targetType", value)} options={all(vocabulary.targetTypes, targetTypeLabel)} />
        <Choice id="report-filter-reason" label="Reason" value={draft.reason} disabled={busy} onChange={(value) => onChange("reason", value)} options={all(vocabulary.reasons, reasonLabel)} />
        <Choice
          id="report-filter-order"
          label="Order"
          value={draft.order}
          disabled={busy}
          onChange={(value) => onChange("order", value)}
          options={[
            ["DESC", "Newest first"],
            ["ASC", "Oldest first"],
          ]}
        />
        <IdInput id="report-filter-reported" label="Reported account ID" value={draft.reportedUserId} error={errors.reportedUserId} disabled={busy} onChange={(value) => onChange("reportedUserId", value)} />
        <IdInput id="report-filter-reporter" label="Reporter account ID" value={draft.reporterUserId} error={errors.reporterUserId} disabled={busy} onChange={(value) => onChange("reporterUserId", value)} />
        <Choice id="report-filter-size" label="Rows per page" value={String(draft.limit)} disabled={busy} onChange={(value) => onChange("limit", Number(value))} options={PAGE_SIZES.map((size) => [String(size), String(size)])} />
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
 * The queue. ⚠️ Identifiers only: the backend sends no names and no content for a queue row, and
 * none is invented here. Opening a report is a deliberate click; nothing is fetched on hover.
 * Props: rows (the route's `data`).
 */
export function ReportTable({ rows }) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <caption className="sr-only">Reports, one per row. Each row links to the full report.</caption>
        <thead className="bg-gray50">
          <tr>
            <th scope="col" className={headCellClass}>Report</th>
            <th scope="col" className={headCellClass}>Submitted</th>
            <th scope="col" className={headCellClass}>Target</th>
            <th scope="col" className={headCellClass}>Reason</th>
            <th scope="col" className={headCellClass}>Status</th>
            <th scope="col" className={headCellClass}>Reported account</th>
            <th scope="col" className={headCellClass}>Listing / message</th>
            <th scope="col" className={headCellClass}>Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray100">
          {rows.map((row) => {
            const stage = reportStage(row);
            return (
              <tr key={row.id} className="hover:bg-[#faf8ff]">
                <td className={cellClass}>
                  <IdText id={row.id} label="report" />
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
                <td className={cellClass}>
                  <span className="font-medium text-gray900">{targetTypeLabel(row.targetType)}</span>
                  {row.targetKind ? <span className="block text-xs text-gray500">{targetKindLabel(row.targetKind)}</span> : null}
                </td>
                <td className={cellClass}>{reasonLabel(row.reason)}</td>
                <td className={cellClass}>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                  {stage.outcome ? <span className="mt-1 block text-xs text-gray600">{stage.outcome}</span> : null}
                </td>
                <td className={cellClass}>
                  <IdText id={row.reportedUserId} label="reported account" />
                </td>
                <td className={cellClass}>
                  {row.targetType === "user" ? <span className="text-gray500">—</span> : <IdText id={row.targetId} label={targetTypeLabel(row.targetType).toLowerCase()} />}
                </td>
                <td className={cellClass}>
                  <Link to={`/moderation/reports/${row.id}`} className={linkClass} aria-label={`${nextStep(row.status)} report ${row.id}`}>
                    {nextStep(row.status)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The queue's body in every state: loading, refused, failed, empty and listed.
 * ⚠️ AN EMPTY QUEUE IS EXPLAINED. While reporting is off nobody can file a report, so "no reports"
 * is never left to read as "no violations".
 * Props: loading, result (the API's answer, or null before the first one), capabilities,
 * filtersActive, onRetry(), onPage(pageNumber).
 */
export function ReportQueueBody({ loading, result, capabilities, filtersActive, onRetry, onPage }) {
  if (!result) return <LoadingRows label="Loading reports…" rows={6} />;
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
  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length === 0) {
    const inactive = reportingInactiveNotice(capabilities);
    if (filtersActive) {
      return <EmptyState title="No reports match these filters">Change or clear the filters to see other reports.</EmptyState>;
    }
    return inactive ? (
      <EmptyState title={inactive.title}>{inactive.detail}</EmptyState>
    ) : (
      <EmptyState title="No reports have been filed">New reports appear here as soon as they are submitted.</EmptyState>
    );
  }
  const inactive = reportingInactiveNotice(capabilities);
  return (
    <div className="space-y-3" aria-busy={loading}>
      {inactive ? (
        <Notice tone="info" title="Customer reporting is not active">
          No new report can be filed while reporting is switched off. The reports below were filed earlier.
        </Notice>
      ) : null}
      <ReportTable rows={rows} />
      <Pager meta={result.meta} onPage={onPage} label="Report pages" />
    </div>
  );
}
