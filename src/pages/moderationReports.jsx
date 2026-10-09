import { useCallback, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { moderationApi } from "../components/moderation/api";
import { ReportFilters, ReportQueueBody } from "../components/moderation/reportQueue";
import { ModerationPage } from "../components/moderation/ui";
import { useLoader } from "../components/moderation/useLoader";
import { DEFAULT_PAGE_SIZE, FALLBACK_VOCABULARY, buildReportQuery } from "../utils/moderation";

const NO_FILTERS = {
  status: "",
  targetType: "",
  reason: "",
  reportedUserId: "",
  reporterUserId: "",
  order: "DESC",
  limit: DEFAULT_PAGE_SIZE,
};
const filtersActive = (filters) =>
  ["status", "targetType", "reason", "reportedUserId", "reporterUserId"].some((key) => Boolean(filters[key]));

/**
 * /moderation/reports — the queue. Filters live in this component's state. A status may arrive in
 * the address (from the overview's counts); an account filter arrives through the router's state,
 * so an account ID is never written into the address bar or the browser's history.
 */
export function ModerationReports() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [initial] = useState(() => ({
    ...NO_FILTERS,
    ...(searchParams.get("status") ? { status: searchParams.get("status") } : {}),
    ...(location.state?.filters ?? {}),
  }));
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [errors, setErrors] = useState({});

  const loadCapabilities = useCallback(() => moderationApi.getCapabilities(), []);
  const capabilities = useLoader(loadCapabilities);
  const loadQueue = useCallback(() => moderationApi.listReports({ ...applied, page }), [applied, page]);
  const queue = useLoader(loadQueue);

  const known = capabilities.value?.ok ? capabilities.value.data : null;
  const vocabulary = known?.reports ?? FALLBACK_VOCABULARY;

  function apply() {
    const check = buildReportQuery(draft);
    setErrors(check.errors);
    if (!check.valid) return;
    setPage(1);
    setApplied({ ...draft });
  }

  function clear() {
    setErrors({});
    setDraft(NO_FILTERS);
    setPage(1);
    setApplied({ ...NO_FILTERS });
  }

  return (
    <ModerationPage title="Reports" description="Every report filed, newest first. Rows carry identifiers only; open a report to review it.">
      <ReportFilters
        vocabulary={vocabulary}
        draft={draft}
        errors={errors}
        busy={queue.loading}
        onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onApply={apply}
        onClear={clear}
      />
      <ReportQueueBody
        loading={queue.loading}
        result={queue.value}
        capabilities={known}
        filtersActive={filtersActive(applied)}
        onRetry={queue.refresh}
        onPage={setPage}
      />
    </ModerationPage>
  );
}
