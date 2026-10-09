import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { moderationApi } from "../components/moderation/api";
import { AuditBody, AuditFilters } from "../components/moderation/auditViews";
import { ModerationPage } from "../components/moderation/ui";
import { useLoader } from "../components/moderation/useLoader";
import { DEFAULT_PAGE_SIZE, FALLBACK_VOCABULARY, buildActionQuery } from "../utils/moderation";

const NO_FILTERS = { subjectType: "", subjectId: "", reportId: "", actorUserId: "", order: "DESC", limit: DEFAULT_PAGE_SIZE };
const filtersActive = (filters) => ["subjectType", "subjectId", "reportId", "actorUserId"].some((key) => Boolean(filters[key]));

/**
 * /moderation/audit — everything a moderator has done, as the backend recorded it. Read-only: this
 * screen has nothing that changes or removes an entry.
 */
export function ModerationAudit() {
  const location = useLocation();
  const [initial] = useState(() => ({ ...NO_FILTERS, ...(location.state?.filters ?? {}) }));
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [errors, setErrors] = useState({});

  const loadCapabilities = useCallback(() => moderationApi.getCapabilities(), []);
  const capabilities = useLoader(loadCapabilities);
  const loadActions = useCallback(() => moderationApi.listActions({ ...applied, page }), [applied, page]);
  const actions = useLoader(loadActions);

  const subjectTypes = capabilities.value?.ok
    ? (capabilities.value.data.audit?.subjectTypes ?? FALLBACK_VOCABULARY.subjectTypes)
    : FALLBACK_VOCABULARY.subjectTypes;

  function apply() {
    const check = buildActionQuery(draft);
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
    <ModerationPage
      title="Audit history"
      description="Every moderation action, with the administrator who took it. Entries are permanent: they cannot be edited or removed."
    >
      <AuditFilters
        subjectTypes={subjectTypes}
        draft={draft}
        errors={errors}
        busy={actions.loading}
        onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onApply={apply}
        onClear={clear}
      />
      <AuditBody
        loading={actions.loading}
        result={actions.value}
        filtersActive={filtersActive(applied)}
        onRetry={actions.refresh}
        onPage={setPage}
      />
    </ModerationPage>
  );
}
