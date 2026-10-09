// Marketplace & Chat moderation — what the Admin Portal SAYS about the backend's answers.
//
// Contract: backend docs/admin-moderation-dashboard.md and docs/marketplace-chat-safety.md
// (production 071a452), all under `admin/moderation`.
//
// ⚠️ SIX DIFFERENT FACTS, NEVER SHOWN AS ONE ANOTHER: a report was received; it is under review; a
// decision was recorded; an action was applied; enforcement is disabled; an account is actually
// restricted. In particular a DECISION is not an ACTION (resolving as "content removed" removes
// nothing), and a RECORDED suspension is not a RESTRICTION (only `accessRestricted` says an account
// is refused). Every label in this file is derived from the field that carries that fact.
//
// Pure functions only: nothing here requests, stores or logs anything.

export const MODERATION_BASE = "admin/moderation";
export const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin access required";
export const SUSPENSION_RECORDED_NOT_ENFORCED = "Suspension recorded — not currently enforced.";
export const NOTE_MAX_LENGTH = 2000;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZES = [10, 25, 50];

/** The deployed vocabularies, used until `GET capabilities` answers (and if it cannot be loaded). */
export const FALLBACK_VOCABULARY = {
  statuses: ["open", "in_review", "actioned", "dismissed"],
  reasons: [
    "spam",
    "harassment",
    "hate",
    "sexual_content",
    "threat",
    "fraud",
    "prohibited_item",
    "impersonation",
    "suspicious_activity",
    "other",
  ],
  targetTypes: ["user", "listing", "message"],
  listingKinds: ["general", "vehicle"],
  decisions: {
    actioned: ["content_removed", "account_suspended", "warning_issued"],
    dismissed: ["no_violation", "insufficient_evidence", "duplicate"],
  },
  subjectTypes: ["report", "listing", "user"],
  actions: [
    "report_review_started",
    "report_actioned",
    "report_dismissed",
    "evidence_viewed",
    "listing_removed",
    "listing_restored",
    "account_suspended",
    "account_reinstated",
    "account_status_changed",
  ],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === "string" && UUID.test(value);
export const shortId = (id) => (typeof id === "string" && id ? `${id.slice(0, 8)}…` : "—");

/** "sexual_content" → "Sexual content". Used for any value this build has no wording for yet. */
export const humanize = (value) => {
  if (typeof value !== "string" || !value) return "";
  const text = value.replaceAll("_", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const worded = (table) => (value) => table[value] ?? humanize(value);

export const reasonLabel = worded({});
export const reportStatusLabel = worded({
  open: "Report received",
  in_review: "Under review",
  actioned: "Decision recorded · upheld",
  dismissed: "Decision recorded · dismissed",
});
export const decisionLabel = worded({ duplicate: "Duplicate report" });
export const targetTypeLabel = worded({ user: "Account", listing: "Listing", message: "Message" });
export const targetKindLabel = worded({
  general: "General listing",
  vehicle: "Vehicle listing",
  marketplace: "Marketplace chat",
  dropbatch: "DropBatch thread",
});
export const subjectTypeLabel = worded({ report: "Report", listing: "Listing", user: "Account" });
export const accountStatusLabel = worded({});
export const listingStatusLabel = worded({});
/**
 * ⚠️ An audit row says what was WRITTEN. `account_suspended` means a suspension was recorded; whether
 * it restricted anyone depended on enforcement at the time, which the row does not carry.
 */
export const actionLabel = worded({
  report_review_started: "Review started",
  report_actioned: "Decision recorded: upheld",
  report_dismissed: "Decision recorded: dismissed",
  evidence_viewed: "Conversation evidence viewed",
  listing_removed: "Listing removed",
  listing_restored: "Listing restored",
  account_suspended: "Account suspension recorded",
  account_reinstated: "Account reinstatement recorded",
  account_status_changed: "Account status changed",
});

const yesNo = (value) => (value ? "Yes" : "No");

/** A timestamp for a table or a timeline, in the portal's locale. Never throws on a bad value. */
export function formatDateTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// ── a report ──

/** Report received · Under review · Decision recorded. Never "violation": that is the decision's to say. */
export function reportStage(report) {
  const status = report?.status;
  if (status === "open") {
    return {
      key: "received",
      label: "Report received",
      tone: "info",
      outcome: null,
      detail: "Not yet reviewed. This is an allegation, not a confirmed violation.",
    };
  }
  if (status === "in_review") {
    return {
      key: "under_review",
      label: "Under review",
      tone: "warning",
      outcome: null,
      detail: "An administrator has started reviewing this allegation. No decision has been recorded.",
    };
  }
  if (status === "actioned" || status === "dismissed") {
    const upheld = status === "actioned";
    return {
      key: "decided",
      label: "Decision recorded",
      tone: upheld ? "brand" : "neutral",
      outcome: `${upheld ? "Upheld" : "Dismissed"}${report.decision ? ` · ${decisionLabel(report.decision)}` : ""}`,
      detail: "A decision records what was concluded. It does not, by itself, remove content or suspend an account.",
    };
  }
  return { key: "unknown", label: humanize(status) || "Unknown status", tone: "neutral", outcome: null, detail: "" };
}

/** What can be done about this report right now. The backend re-checks every one of them. */
export function availableReportActions(report) {
  if (!report || typeof report !== "object") {
    return { canStartReview: false, canResolve: false, canViewConversation: false, listing: null, account: null };
  }
  const reported = report.reported;
  return {
    canStartReview: report.status === "open",
    canResolve: report.status === "open" || report.status === "in_review",
    canViewConversation: report.targetType === "message",
    listing:
      report.targetType === "listing" && report.target?.exists
        ? {
            kind: report.targetKind,
            id: report.targetId,
            status: report.target.status,
            canRemove: report.target.status !== "removed",
            canRestore: report.target.status === "removed",
          }
        : null,
    account:
      reported && !reported.deleted && reported.accountStatus
        ? {
            id: report.reportedUserId,
            canSuspend: reported.accountStatus !== "blocked",
            canReinstate: reported.accountStatus === "blocked",
          }
        : null,
  };
}

const APPLIED = ["listing_removed", "listing_restored", "account_suspended", "account_reinstated", "account_status_changed"];

/** The actions actually written for this report (from its history), oldest first. */
export function appliedActions(report) {
  return (report?.history ?? [])
    .filter((row) => APPLIED.includes(row.action))
    .map((row) => ({ id: row.id, action: row.action, label: actionLabel(row.action), at: row.createdAt }));
}

/**
 * ⚠️ A DECISION IS NOT AN ACTION. After "content removed" or "account suspended" is recorded, this
 * says whether the thing the decision names has actually happened — from the listing's current
 * status and the account's `accessRestricted`, never from the decision itself.
 */
export function decisionFollowUp(report) {
  if (!report || (report.status !== "actioned" && report.status !== "dismissed")) return null;
  if (report.decision === "content_removed" && report.targetType === "listing" && report.target?.exists) {
    return report.target.status === "removed"
      ? { tone: "success", title: "Action applied — the listing is removed", detail: "" }
      : {
          tone: "warning",
          title: "Decision recorded — the listing is still live",
          detail: "Recording the decision did not remove the listing. Use “Remove listing” to apply it.",
        };
  }
  if (report.decision === "account_suspended" && report.reported && !report.reported.deleted) {
    if (report.reported.accessRestricted === true) {
      return { tone: "success", title: "Action applied — the account is suspended and access is blocked", detail: "" };
    }
    if (report.reported.accountStatus === "blocked") {
      return {
        tone: "warning",
        title: SUSPENSION_RECORDED_NOT_ENFORCED,
        detail: "Suspension enforcement is off, so this account can still sign in.",
      };
    }
    return {
      tone: "warning",
      title: "Decision recorded — no suspension is recorded for this account",
      detail: "Recording the decision did not suspend the account. Use “Record suspension” to apply it.",
    };
  }
  return null;
}

// ── an account: recorded is not restricted ──

/**
 * ⚠️ THE LABEL FOLLOWS `accessRestricted`. A row that says `blocked` is what an administrator
 * recorded; only `accessRestricted: true` means the account is refused sign-in and API access.
 */
export function accountRestrictionView(account) {
  if (!account || typeof account !== "object") {
    return { label: "Account unavailable", tone: "neutral", restricted: false, detail: "" };
  }
  if (account.deleted) {
    return account.accountStatus == null
      ? { label: "Account no longer exists", tone: "neutral", restricted: false, detail: "" }
      : {
          label: "Account deleted",
          tone: "neutral",
          restricted: false,
          detail: "The account was deleted. A suspension is not what stops it.",
        };
  }
  if (account.accessRestricted === true) {
    return {
      label: "Suspended — access blocked",
      tone: "danger",
      restricted: true,
      detail: "Suspension is enforced: this account is refused sign-in and API access.",
    };
  }
  if (account.accountStatus === "blocked") {
    return {
      label: "Suspension recorded — not currently enforced",
      tone: "warning",
      restricted: false,
      detail: "A suspension is recorded, but enforcement is off: this account can still sign in.",
    };
  }
  if (account.accountStatus === "inactive") {
    return { label: "Inactive — no restriction", tone: "neutral", restricted: false, detail: "“Inactive” restricts nothing." };
  }
  if (account.accountStatus === "active") return { label: "Active", tone: "success", restricted: false, detail: "" };
  return {
    label: account.accountStatus ? `Status: ${accountStatusLabel(account.accountStatus)}` : "Status unavailable",
    tone: "neutral",
    restricted: false,
    detail: "",
  };
}

/**
 * The answer to a suspend or reinstate request: `{ status, previousStatus, changed, enforced,
 * accessRestricted }`. The title is chosen from `accessRestricted` and `enforced`, never from which
 * button was pressed.
 */
export function describeAccountActionResult(kind, data) {
  if (!data || typeof data !== "object") {
    return {
      tone: "error",
      title: "Result unknown — check the account's status before retrying.",
      warning: null,
      facts: [],
    };
  }
  const facts = [
    ["Recorded status", accountStatusLabel(data.status)],
    ["Previous status", accountStatusLabel(data.previousStatus)],
    ["Enforcement enabled", yesNo(data.enforced)],
    ["Access actually restricted", yesNo(data.accessRestricted)],
    ["Changed by this action", data.changed ? "Yes" : "No — it was already recorded"],
  ];
  const later = "This account can still sign in. The recorded suspension could take effect if enforcement is activated later.";

  if (kind === "suspend") {
    if (data.accessRestricted === true) {
      return {
        tone: "success",
        title: data.changed ? "Account suspended — access is blocked" : "No change — the account was already suspended and access is blocked",
        warning: null,
        facts,
      };
    }
    return {
      tone: "warning",
      title: data.changed
        ? SUSPENSION_RECORDED_NOT_ENFORCED
        : "No change — a suspension was already recorded. It is not currently enforced.",
      warning: later,
      facts,
    };
  }

  if (!data.changed) {
    return { tone: "info", title: "No change — the account was not suspended", warning: null, facts };
  }
  return data.enforced
    ? { tone: "success", title: "Account reinstated — access restored", warning: null, facts }
    : { tone: "info", title: "Reinstatement recorded — suspension is not currently enforced.", warning: null, facts };
}

/** The answer to a remove or restore request: `{ status, previousStatus, changed }`. */
export function describeListingActionResult(kind, data) {
  if (!data || typeof data !== "object") {
    return { tone: "error", title: "Result unknown — check the listing's status before retrying.", facts: [] };
  }
  const facts = [
    ["Previous status", listingStatusLabel(data.previousStatus)],
    ["Current status", listingStatusLabel(data.status)],
    ["Changed by this action", data.changed ? "Yes" : "No"],
  ];
  if (kind === "remove") {
    return data.changed
      ? { tone: "success", title: "Listing removed", facts }
      : { tone: "info", title: "No change — the listing was already removed", facts };
  }
  return data.changed
    ? { tone: "success", title: `Listing restored to: ${listingStatusLabel(data.status)}`, facts }
    : { tone: "info", title: `No change — the listing is not removed (${listingStatusLabel(data.status)})`, facts };
}

// ── feature states ──

const POLICY_LABELS = { terms_of_service: "Terms of service", acceptable_use: "Acceptable use" };

/**
 * DISABLED · AVAILABLE · ENFORCED, one row per safety feature.
 *
 * ⚠️ Recording a suspension and enforcing one are two rows on purpose: the first is always
 * available, and only the second decides whether a suspended account is refused.
 */
export function describeCapabilities(capabilities) {
  const features = capabilities?.features;
  if (!features || typeof features !== "object") return null;
  const terms = capabilities.terms ?? {};
  const policies = Array.isArray(capabilities.policies) ? capabilities.policies : [];
  const policyName = POLICY_LABELS[terms.policyId] ?? humanize(terms.policyId) ?? "the policy";
  const termsPublished = policies.some((policy) => policy.policyId === terms.policyId && policy.published);

  let termsRow;
  if (terms.required) {
    termsRow = {
      state: "ENFORCED",
      detail: `Posting in Marketplace and chat requires accepting ${policyName}, version ${terms.version}.`,
    };
  } else if (features.termsEnforcement) {
    termsRow = { state: "DISABLED", detail: "Switched on, but no policy version is published, so nothing is required." };
  } else if (termsPublished) {
    termsRow = { state: "AVAILABLE", detail: "A policy version is published and acceptance can be recorded, but it is not required." };
  } else {
    termsRow = { state: "DISABLED", detail: "Nobody is asked to accept a policy before posting." };
  }

  return {
    reportingOff: !features.reporting,
    enforcementOff: !features.accountEnforcement,
    rows: [
      {
        key: "reporting",
        name: "Customer reporting",
        state: features.reporting ? "AVAILABLE" : "DISABLED",
        detail: features.reporting
          ? "Users can file reports. New reports appear in the queue."
          : "Users cannot file reports. The queue only changes when reporting is turned on.",
      },
      {
        key: "blocking",
        name: "User blocking",
        state: features.blocking ? "ENFORCED" : "DISABLED",
        detail: features.blocking
          ? "Users can block each other, and blocks are enforced in Marketplace chat and offers."
          : "Users cannot block each other, and no block is applied.",
      },
      {
        key: "suspensionRecording",
        name: "Recording account suspensions",
        state: "AVAILABLE",
        detail: "Administrators can record a suspension or a reinstatement. Every change is audited.",
      },
      {
        key: "suspensionEnforcement",
        name: "Account suspension enforcement",
        state: features.accountEnforcement ? "ENFORCED" : "DISABLED",
        detail: features.accountEnforcement
          ? "A suspended account is signed out and refused sign-in and API access."
          : "A recorded suspension does not restrict access: the account can still sign in.",
      },
      { key: "terms", name: "Terms acceptance", ...termsRow },
    ],
    policies: policies.map((policy) => ({
      policyId: policy.policyId,
      label: POLICY_LABELS[policy.policyId] ?? humanize(policy.policyId),
      state: policy.published ? "PUBLISHED" : "NOT PUBLISHED",
      version: policy.published ? policy.currentVersion : null,
    })),
  };
}

/** Why the queue is empty while reporting is off — and what that emptiness does NOT mean. */
export function reportingInactiveNotice(capabilities) {
  if (!capabilities?.features || capabilities.features.reporting) return null;
  return {
    title: "Customer reporting is not active yet",
    detail:
      "Users cannot file reports while reporting is switched off, so an empty queue does not mean there have been no policy violations.",
  };
}

export function decisionOptions(capabilities) {
  const decisions = capabilities?.reports?.decisions ?? FALLBACK_VOCABULARY.decisions;
  const options = (values) => (Array.isArray(values) ? values : []).map((value) => ({ value, label: decisionLabel(value) }));
  return [
    { outcome: "actioned", label: "Upheld", options: options(decisions.actioned) },
    { outcome: "dismissed", label: "Dismissed", options: options(decisions.dismissed) },
  ];
}

// ── requests ──

const ID_ERROR = "Enter a complete ID (36 characters, including dashes).";

function paging(filters) {
  const limit = Number(filters.limit);
  const page = Number(filters.page);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    limit: Number.isInteger(limit) && limit >= 1 ? Math.min(limit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
    order: filters.order === "ASC" ? "ASC" : "DESC",
  };
}

function build(filters, choices, ids) {
  const source = filters ?? {};
  const params = {};
  const errors = {};
  for (const key of choices) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    if (value && value !== "all") params[key] = value;
  }
  for (const key of ids) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    if (!value) continue;
    // A partial ID is never sent: it would only come back as a 400.
    if (isUuid(value)) params[key] = value;
    else errors[key] = ID_ERROR;
  }
  return { valid: Object.keys(errors).length === 0, errors, params: { ...params, ...paging(source) } };
}

/** `GET reports` — status, targetType, reason, reportedUserId, reporterUserId, page, limit (≤ 50), order. */
export const buildReportQuery = (filters) =>
  build(filters, ["status", "targetType", "reason"], ["reportedUserId", "reporterUserId"]);

/** `GET actions` — reportId, subjectType, subjectId, actorUserId, page, limit (≤ 50), order. */
export const buildActionQuery = (filters) => build(filters, ["subjectType"], ["reportId", "subjectId", "actorUserId"]);

export function validateNote(text, { required = false, max = NOTE_MAX_LENGTH } = {}) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  const count = trimmed.length;
  if (required && count === 0) return { ok: false, trimmed, count, error: "A reason is required." };
  if (count > max) return { ok: false, trimmed, count, error: `Keep this to ${max} characters or fewer.` };
  return { ok: true, trimmed, count, error: "" };
}

/** ⚠️ The backend refuses an empty `note`, so an empty optional note is left out, not sent as "". */
export function resolutionBody(decision, note) {
  const { trimmed } = validateNote(note);
  return trimmed ? { decision, note: trimmed } : { decision };
}

/** A listing or account action: the reason is required; `reportId` ties it to the report's history. */
export function actionBody(note, reportId) {
  const { trimmed } = validateNote(note, { required: true });
  return reportId ? { note: trimmed, reportId } : { note: trimmed };
}

// ── errors ──

const UNKNOWN_RESULT = "Result unknown — the latest state has been reloaded. Check it before retrying.";

/**
 * Turns a failed request into `{ kind, status, code, message }`. Only the response's own `message`
 * and `details.code` are read; nothing else in the body is carried, shown or logged.
 *
 * ⚠️ A 403 IS NEVER SILENT. "Admin access required" means the signed-in account is not (or is no
 * longer) an administrator; any other 403 is the backend refusing this particular action.
 */
export function classifyModerationError(error, { mutation = false } = {}) {
  const status = error?.response?.status;
  const body = error?.response?.data;
  const raw = body && typeof body === "object" ? body.message : undefined;
  const message = Array.isArray(raw) ? raw.filter((part) => typeof part === "string").join(". ") : typeof raw === "string" ? raw : "";
  const code = body && typeof body === "object" && typeof body.details?.code === "string" ? body.details.code : null;
  const result = (kind, text) => ({ kind, status: status ?? null, code, message: text });

  if (!status) {
    return result(
      "network",
      mutation ? UNKNOWN_RESULT : "The moderation service could not be reached. Check your connection and try again."
    );
  }
  if (status === 401) return result("session", "Your session has ended. Sign in again to continue.");
  if (status === 403) {
    if (code === "FEATURE_DISABLED") return result("feature_disabled", message || "This feature is not available.");
    if (!message || message === ADMIN_ACCESS_REQUIRED_MESSAGE) {
      return result(
        "forbidden",
        "Moderation is restricted to current administrators. This account does not have administrator access, or no longer has it."
      );
    }
    return result("refused", message);
  }
  if (status === 404) return result("not_found", message || "Not found.");
  if (status === 409) return result("conflict", message || "This was changed by someone else.");
  if (status === 400) return result("invalid", message || "The request was not accepted.");
  return result(
    "server",
    mutation ? UNKNOWN_RESULT : "The moderation service did not answer properly. Nothing was changed; try again shortly."
  );
}

/**
 * What a page says after a write failed. For a decision, a 409 is not an error to retry: someone
 * else decided first, and the reloaded report is what is true now.
 */
export function mutationFailureNotice(error, { resolving = false } = {}) {
  if (resolving && error?.kind === "conflict") {
    return {
      tone: "warning",
      title: "This report has already been resolved",
      detail: "Another administrator may have recorded a decision first. The latest state has been loaded below.",
    };
  }
  return { tone: "error", title: "The action was not completed", detail: error?.message ?? "" };
}

/**
 * A refusal the administrator caused and can read where they caused it — an invalid reason, an
 * administrator account that cannot be suspended, a listing a moderator did not remove — stays in
 * the confirmation. Anything else (a decision's 409, a lost session, an unknown result) closes it,
 * because the page underneath has been reloaded and is what matters.
 */
export function inDialogError(action, error) {
  if (!error) return "";
  const kinds = action === "resolve" ? ["invalid"] : ["invalid", "refused", "not_found", "conflict"];
  return kinds.includes(error.kind) ? error.message : "";
}

// ── evidence ──

const httpsOnly = (values) => (Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && /^https:\/\//i.test(value));

/** The snapshot the reporter submitted with the report. Not the surrounding conversation. */
export function evidenceSnapshotView(report) {
  const evidence = report?.evidence && typeof report.evidence === "object" ? report.evidence : {};
  if (report?.targetType === "listing") {
    return {
      kind: "listing",
      title: evidence.title ?? null,
      description: evidence.description ?? null,
      descriptionTruncated: Boolean(evidence.descriptionTruncated),
      price: evidence.price ?? null,
      statusWhenReported: evidence.status ? listingStatusLabel(evidence.status) : null,
      photos: httpsOnly(evidence.photos),
    };
  }
  if (report?.targetType === "message") {
    return {
      kind: "message",
      body: evidence.body ?? null,
      bodyTruncated: Boolean(evidence.bodyTruncated),
      sentAt: evidence.sentAt ?? null,
      attachmentCount: Array.isArray(evidence.attachments) ? evidence.attachments.length : 0,
      sourceLabel: targetKindLabel(report.targetKind),
      listingId: evidence.listingId ?? null,
      listingKind: evidence.listingKind ?? null,
    };
  }
  return { kind: "account" };
}

const ROLE_LABELS = { reported: "Reported account", reporter: "Reporter", other: "Other participant" };

/** The audited conversation context: who sent each message relative to this report, oldest first. */
export function conversationView(evidence, report) {
  const messages = Array.isArray(evidence?.messages) ? evidence.messages : [];
  return {
    sourceLabel: targetKindLabel(evidence?.source ?? report?.targetKind),
    messages: messages.map((message) => {
      const role =
        message.senderUserId === report?.reportedUserId
          ? "reported"
          : message.senderUserId === report?.reporterUserId
            ? "reporter"
            : "other";
      const links = httpsOnly(message.attachments);
      return {
        id: message.id,
        body: message.body ?? "",
        createdAt: message.createdAt ?? null,
        reported: Boolean(message.reported),
        role,
        roleLabel: ROLE_LABELS[role],
        attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
        attachmentLinks: links,
      };
    }),
  };
}

// ── audit ──

function metadataSummary(action) {
  const metadata = action?.metadata && typeof action.metadata === "object" ? action.metadata : {};
  // Only the keys the backend documents; anything else in `metadata` is not for display.
  if (typeof metadata.decision === "string") return `Decision: ${decisionLabel(metadata.decision)}`;
  if (typeof metadata.source === "string") return `Source: ${targetKindLabel(metadata.source)}`;
  if (action?.action === "listing_removed" && typeof metadata.previousStatus === "string") {
    return `${listingStatusLabel(metadata.previousStatus)} → Removed`;
  }
  if (action?.action === "listing_restored" && typeof metadata.status === "string") {
    return `Removed → ${listingStatusLabel(metadata.status)}`;
  }
  if (typeof metadata.previousStatus === "string" && typeof metadata.status === "string") {
    return `${accountStatusLabel(metadata.previousStatus)} → ${accountStatusLabel(metadata.status)}`;
  }
  return "";
}

/** One audit row for a table: no free text (`hasNote` says a reason exists; it is opened deliberately). */
export function auditRowView(action) {
  const kind = action?.subjectKind ? ` · ${targetKindLabel(action.subjectKind)}` : "";
  return {
    id: action?.id ?? null,
    when: action?.createdAt ?? null,
    actionLabel: actionLabel(action?.action),
    actorId: action?.actorUserId ?? null,
    subjectLabel: `${subjectTypeLabel(action?.subjectType)}${kind}`,
    subjectId: action?.subjectId ?? null,
    reportId: action?.reportId ?? null,
    details: metadataSummary(action),
    hasNote: typeof action?.note === "string" && action.note.trim().length > 0,
  };
}

// ── paging ──

export function paginationView(meta) {
  const page = Number(meta?.page) || 1;
  const limit = Number(meta?.limit) || DEFAULT_PAGE_SIZE;
  const itemCount = Number(meta?.itemCount) || 0;
  const pageCount = Number(meta?.pageCount) || 0;
  return {
    page,
    pageCount,
    itemCount,
    from: itemCount === 0 ? 0 : (page - 1) * limit + 1,
    to: Math.min(page * limit, itemCount),
    hasPages: pageCount > 1,
  };
}
