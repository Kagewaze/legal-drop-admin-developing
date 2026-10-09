/* eslint-env node */
// An in-memory stand-in for the backend's moderation routes, for tests and local browser QA.
//
// It follows the deployed contract (backend docs/admin-moderation-dashboard.md, production
// 071a452): the same paths, envelopes, status codes, messages, paging and the same rules about what
// is recorded versus what is enforced. It holds SYNTHETIC data only and talks to nothing.
//
//   const backend = createMockModerationBackend({ data: "populated", features: { reporting: true } });
//   backend.request({ method: "GET", path: "admin/moderation/reports", query: { status: "open" }, token });
//     -> { status, body }      body is exactly what the real API would send
import {
  ADMIN,
  BUYER,
  EVIDENCE_CONTEXT_WINDOW,
  NOTE_MAX_LENGTH,
  PRODUCTION_FEATURES,
  SELLER,
  TOKENS,
  VOCABULARY,
  actionId,
  syntheticAccounts,
  syntheticActions,
  syntheticListings,
  syntheticReports,
  syntheticThreads,
} from "./moderationFixtures.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALL_DECISIONS = [...VOCABULARY.decisions.actioned, ...VOCABULARY.decisions.dismissed];
const POLICIES = ["terms_of_service", "acceptable_use"];

export const MESSAGES = {
  missingHeader: "Authorization header is missing",
  expired: "jwt expired",
  invalidToken: "invalid token",
  adminRequired: "Admin access required",
  reportNotFound: "Report not found",
  alreadyResolved: "This report has already been resolved.",
  notAMessage: "This report is not about a message.",
  listingNotFound: "Listing not found",
  notModeratorRemoved: "This listing was not removed by a moderator and cannot be restored here.",
  userNotFound: "User not found",
  adminCannotBeSuspended: "Administrator accounts cannot be suspended. Remove the administrator role first.",
  suspendedAndEnforced: "Account suspended",
  suspendedRecordedOnly:
    "Suspension recorded. It is not being enforced at the moment: this account can still sign in.",
  reinstatedAndEnforced: "Account reinstated",
  reinstatedRecordedOnly: "Reinstatement recorded. Suspension is not being enforced at the moment.",
};

const ok = (data, message, status = 200) => ({ status, body: { success: true, data, message } });
const page = (rows, meta, message) => ({ status: 200, body: { success: true, data: rows, message, meta } });
const refuse = (status, message, details) => ({
  status,
  body: { success: false, statusCode: status, message, ...(details ? { details } : {}) },
});
const oneOf = (name, values) => `${name} must be one of the following values: ${values.join(", ")}`;

export function createMockModerationBackend(options = {}) {
  const features = { ...PRODUCTION_FEATURES, ...(options.features ?? {}) };
  const published = { terms_of_service: null, acceptable_use: null, ...(options.policies ?? {}) };
  const populated = options.data === "populated";
  const state = {
    features,
    published,
    accounts: syntheticAccounts(),
    listings: populated ? syntheticListings() : [],
    threads: populated ? syntheticThreads() : { marketplace: [], dropbatch: [] },
    reports: populated ? syntheticReports() : [],
    actions: populated ? syntheticActions() : [],
    requests: [],
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 9, 9, 12, 0, 0) + ++tick * 60000).toISOString();
  const nextActionId = () => actionId(9000 + state.actions.length + 1);

  const account = (id) => state.accounts.find((row) => row.id === id) ?? null;
  const restricted = (row) =>
    Boolean(row) && !row.deletedAt && features.accountEnforcement && row.status === "blocked" && row.role !== "ADMIN";

  function identify(token) {
    if (!token) return refuse(401, MESSAGES.missingHeader);
    if (token === TOKENS.expired) return refuse(401, MESSAGES.expired);
    if (token === TOKENS.admin) return { id: ADMIN };
    // A customer, and an account that used to be an administrator: both hold a valid session and
    // neither is an administrator now.
    if (token === TOKENS.customer || token === TOKENS.formerAdmin) return refuse(403, MESSAGES.adminRequired);
    return refuse(401, MESSAGES.invalidToken);
  }

  function audit(actorUserId, action, fields) {
    const row = {
      id: nextActionId(),
      createdAt: now(),
      actorUserId,
      action,
      reportId: null,
      subjectType: "report",
      subjectId: null,
      subjectKind: null,
      note: null,
      metadata: {},
      ...fields,
    };
    state.actions.push(row);
    return row;
  }

  function paging(query) {
    const order = query.order ?? "DESC";
    if (!["ASC", "DESC"].includes(order)) return { error: refuse(400, oneOf("order", ["ASC", "DESC"])) };
    const pageNumber = query.page === undefined ? 1 : Number(query.page);
    if (!Number.isInteger(pageNumber)) return { error: refuse(400, "page must be an integer number") };
    if (pageNumber < 1) return { error: refuse(400, "page must not be less than 1") };
    const limit = query.limit === undefined ? 10 : Number(query.limit);
    if (!Number.isInteger(limit)) return { error: refuse(400, "limit must be an integer number") };
    if (limit < 1) return { error: refuse(400, "limit must not be less than 1") };
    if (limit > 50) return { error: refuse(400, "limit must not be greater than 50") };
    return { order, page: pageNumber, limit };
  }

  function paged(rows, { order, page: pageNumber, limit }, message, project = (row) => row) {
    const sorted = [...rows].sort((a, b) =>
      order === "ASC" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)
    );
    const itemCount = sorted.length;
    const pageCount = Math.ceil(itemCount / limit);
    const slice = sorted.slice((pageNumber - 1) * limit, pageNumber * limit).map(project);
    return page(
      slice,
      { page: pageNumber, limit, itemCount, pageCount, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < pageCount },
      message
    );
  }

  const summary = (report) => ({
    id: report.id,
    createdAt: report.createdAt,
    status: report.status,
    reason: report.reason,
    targetType: report.targetType,
    targetKind: report.targetKind,
    targetId: report.targetId,
    reporterUserId: report.reporterUserId,
    reportedUserId: report.reportedUserId,
    decision: report.decision,
    resolvedAt: report.resolvedAt,
  });

  function accountSummary(id) {
    const row = account(id);
    if (!row) return { id, name: null, accountStatus: null, accessRestricted: false, deleted: true };
    return {
      id,
      name: [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
      accountStatus: row.status,
      accessRestricted: restricted(row),
      deleted: Boolean(row.deletedAt),
    };
  }

  function detail(report) {
    const about = state.reports.filter((row) => row.reportedUserId === report.reportedUserId);
    const listing =
      report.targetType === "listing"
        ? state.listings.find((row) => row.id === report.targetId && row.kind === report.targetKind)
        : undefined;
    return {
      ...report,
      reporter: accountSummary(report.reporterUserId),
      reported: {
        ...accountSummary(report.reportedUserId),
        reports: { total: about.length, actioned: about.filter((row) => row.status === "actioned").length },
      },
      target:
        report.targetType !== "listing"
          ? null
          : listing
            ? { exists: true, title: listing.title, status: listing.status }
            : { exists: false, title: null, status: null },
      history: state.actions
        .filter((row) => row.reportId === report.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  }

  function findReport(id) {
    if (!UUID.test(id)) return { error: refuse(400, "Validation failed (uuid is expected)") };
    const report = state.reports.find((row) => row.id === id);
    return report ? { report } : { error: refuse(404, MESSAGES.reportNotFound) };
  }

  /** `note` is required for an action and optional for a decision; an empty one is never accepted. */
  function readNote(body, required) {
    const raw = body?.note;
    if (raw === undefined || raw === null) {
      return required ? { error: refuse(400, "note should not be empty") } : { note: null };
    }
    if (typeof raw !== "string") return { error: refuse(400, "note must be a string") };
    const note = raw.trim();
    if (!note) return { error: refuse(400, "note should not be empty") };
    if (note.length > NOTE_MAX_LENGTH) {
      return { error: refuse(400, `note must be shorter than or equal to ${NOTE_MAX_LENGTH} characters`) };
    }
    return { note };
  }

  function readLinkedReport(body) {
    const id = body?.reportId;
    if (id === undefined || id === null) return { reportId: null };
    if (typeof id !== "string" || !UUID.test(id)) return { error: refuse(400, "reportId must be a UUID") };
    if (!state.reports.some((row) => row.id === id)) return { error: refuse(404, MESSAGES.reportNotFound) };
    return { reportId: id };
  }

  function capabilities() {
    const required =
      features.termsEnforcement && published.acceptable_use ? published.acceptable_use : null;
    return ok(
      {
        features: { ...features },
        terms: { required: required !== null, policyId: "acceptable_use", version: required },
        policies: POLICIES.map((policyId) => ({
          policyId,
          currentVersion: published[policyId] ?? null,
          published: Boolean(published[policyId]),
        })),
        accounts: {
          statuses: ["active", "inactive", "blocked"],
          suspendedStatus: "blocked",
          administratorsCanBeSuspended: false,
        },
        reports: {
          statuses: [...VOCABULARY.statuses],
          reasons: [...VOCABULARY.reasons],
          targetTypes: [...VOCABULARY.targetTypes],
          listingKinds: [...VOCABULARY.listingKinds],
          decisions: {
            actioned: [...VOCABULARY.decisions.actioned],
            dismissed: [...VOCABULARY.decisions.dismissed],
          },
        },
        audit: { actions: [...VOCABULARY.actions], subjectTypes: [...VOCABULARY.subjectTypes] },
        limits: { noteMaxLength: NOTE_MAX_LENGTH, evidenceContextWindow: EVIDENCE_CONTEXT_WINDOW },
      },
      "Moderation capabilities fetched successfully"
    );
  }

  function listReports(query) {
    const options = paging(query);
    if (options.error) return options.error;
    if (query.status !== undefined && !VOCABULARY.statuses.includes(query.status)) {
      return refuse(400, oneOf("status", VOCABULARY.statuses));
    }
    if (query.targetType !== undefined && !VOCABULARY.targetTypes.includes(query.targetType)) {
      return refuse(400, oneOf("targetType", VOCABULARY.targetTypes));
    }
    if (query.reason !== undefined && !VOCABULARY.reasons.includes(query.reason)) {
      return refuse(400, oneOf("reason", VOCABULARY.reasons));
    }
    for (const key of ["reportedUserId", "reporterUserId"]) {
      if (query[key] !== undefined && !UUID.test(query[key])) return refuse(400, `${key} must be a UUID`);
    }
    const rows = state.reports.filter(
      (row) =>
        (!query.status || row.status === query.status) &&
        (!query.targetType || row.targetType === query.targetType) &&
        (!query.reason || row.reason === query.reason) &&
        (!query.reportedUserId || row.reportedUserId === query.reportedUserId) &&
        (!query.reporterUserId || row.reporterUserId === query.reporterUserId)
    );
    return paged(rows, options, "Reports fetched successfully", summary);
  }

  function listActions(query) {
    const options = paging(query);
    if (options.error) return options.error;
    if (query.subjectType !== undefined && !VOCABULARY.subjectTypes.includes(query.subjectType)) {
      return refuse(400, oneOf("subjectType", VOCABULARY.subjectTypes));
    }
    for (const key of ["reportId", "subjectId", "actorUserId"]) {
      if (query[key] !== undefined && !UUID.test(query[key])) return refuse(400, `${key} must be a UUID`);
    }
    const rows = state.actions.filter(
      (row) =>
        (!query.reportId || row.reportId === query.reportId) &&
        (!query.subjectType || row.subjectType === query.subjectType) &&
        (!query.subjectId || row.subjectId === query.subjectId) &&
        (!query.actorUserId || row.actorUserId === query.actorUserId)
    );
    return paged(rows, options, "Moderation actions fetched successfully");
  }

  function openEvidence(report, actor) {
    if (report.targetType !== "message") return refuse(400, MESSAGES.notAMessage);
    // The access is recorded BEFORE anything is returned, every time.
    audit(actor, "evidence_viewed", {
      reportId: report.id,
      subjectId: report.id,
      metadata: { source: report.targetKind },
    });
    const thread = (state.threads[report.targetKind] ?? []).filter((row) => row.threadId === report.contextId);
    const index = thread.findIndex((row) => row.id === report.targetId);
    const window =
      index < 0
        ? []
        : thread.slice(Math.max(0, index - EVIDENCE_CONTEXT_WINDOW), index + EVIDENCE_CONTEXT_WINDOW + 1);
    return ok(
      {
        reportId: report.id,
        source: report.targetKind,
        contextId: report.contextId,
        messages: window.map((row) => ({
          id: row.id,
          senderUserId: row.senderUserId,
          body: row.body,
          attachments: row.attachments ?? [],
          createdAt: row.createdAt,
          reported: row.id === report.targetId,
        })),
      },
      "Evidence access recorded"
    );
  }

  function startReview(report, actor) {
    if (report.status === "open") {
      report.status = "in_review";
      report.updatedAt = now();
      audit(actor, "report_review_started", { reportId: report.id, subjectId: report.id });
    } else if (report.status !== "in_review") {
      return refuse(409, MESSAGES.alreadyResolved);
    }
    return ok(detail(report), "Report is under review");
  }

  function resolve(report, actor, body) {
    if (!ALL_DECISIONS.includes(body?.decision)) return refuse(400, oneOf("decision", ALL_DECISIONS));
    const read = readNote(body, false);
    if (read.error) return read.error;
    if (report.status !== "open" && report.status !== "in_review") return refuse(409, MESSAGES.alreadyResolved);
    const outcome = VOCABULARY.decisions.actioned.includes(body.decision) ? "actioned" : "dismissed";
    Object.assign(report, {
      status: outcome,
      decision: body.decision,
      resolutionNote: read.note,
      resolvedAt: now(),
      resolvedByUserId: actor,
    });
    audit(actor, outcome === "actioned" ? "report_actioned" : "report_dismissed", {
      reportId: report.id,
      subjectId: report.id,
      note: read.note,
      metadata: { decision: body.decision },
    });
    return ok(detail(report), "Report resolved");
  }

  function moderateListing(kind, id, verb, actor, body) {
    if (!VOCABULARY.listingKinds.includes(kind)) return refuse(400, "Validation failed (enum string is expected)");
    if (!UUID.test(id)) return refuse(400, "Validation failed (uuid is expected)");
    const read = readNote(body, true);
    if (read.error) return read.error;
    const linked = readLinkedReport(body);
    if (linked.error) return linked.error;
    const listing = state.listings.find((row) => row.id === id && row.kind === kind);
    if (!listing) return refuse(404, MESSAGES.listingNotFound);
    const base = { listingId: id, listingKind: kind };

    if (verb === "remove") {
      const previousStatus = listing.status;
      if (previousStatus === "removed") {
        return ok({ ...base, status: "removed", previousStatus, changed: false }, "Listing removed");
      }
      listing.status = "removed";
      audit(actor, "listing_removed", {
        reportId: linked.reportId,
        subjectType: "listing",
        subjectId: id,
        subjectKind: kind,
        note: read.note,
        metadata: { previousStatus },
      });
      return ok({ ...base, status: "removed", previousStatus, changed: true }, "Listing removed");
    }

    if (listing.status !== "removed") {
      return ok({ ...base, status: listing.status, previousStatus: listing.status, changed: false }, "Listing restored");
    }
    const last = state.actions
      .filter(
        (row) =>
          row.subjectType === "listing" && row.subjectId === id && ["listing_removed", "listing_restored"].includes(row.action)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const restored = last?.metadata?.previousStatus;
    if (typeof restored !== "string") return refuse(409, MESSAGES.notModeratorRemoved);
    listing.status = restored;
    audit(actor, "listing_restored", {
      reportId: linked.reportId,
      subjectType: "listing",
      subjectId: id,
      subjectKind: kind,
      note: read.note,
      metadata: { status: restored },
    });
    return ok({ ...base, status: restored, previousStatus: "removed", changed: true }, "Listing restored");
  }

  function setSuspended(id, suspended, actor, body) {
    if (!UUID.test(id)) return refuse(400, "Validation failed (uuid is expected)");
    const read = readNote(body, true);
    if (read.error) return read.error;
    const linked = readLinkedReport(body);
    if (linked.error) return linked.error;
    const row = account(id);
    if (!row || row.deletedAt) return refuse(404, MESSAGES.userNotFound);
    if (suspended && row.role === "ADMIN") return refuse(403, MESSAGES.adminCannotBeSuspended);
    const status = suspended ? "blocked" : "active";
    const previousStatus = row.status;
    const changed = previousStatus !== status;
    if (changed) {
      row.status = status;
      audit(
        actor,
        suspended ? "account_suspended" : previousStatus === "blocked" ? "account_reinstated" : "account_status_changed",
        {
          reportId: linked.reportId,
          subjectType: "user",
          subjectId: id,
          note: read.note,
          metadata: { previousStatus, status },
        }
      );
    }
    const enforced = features.accountEnforcement;
    const data = { userId: id, status, previousStatus, changed, enforced, accessRestricted: restricted(row) };
    const message = suspended
      ? enforced
        ? MESSAGES.suspendedAndEnforced
        : MESSAGES.suspendedRecordedOnly
      : enforced
        ? MESSAGES.reinstatedAndEnforced
        : MESSAGES.reinstatedRecordedOnly;
    return ok(data, message);
  }

  /** One request, exactly as the API would answer it. `path` is relative to `/api/`. */
  function request({ method = "GET", path = "", query = {}, body, token } = {}) {
    const verb = method.toUpperCase();
    const clean = path.replace(/^\/+|\/+$/g, "");
    state.requests.push(`${verb} ${clean}`);
    const notFound = () => refuse(404, `Cannot ${verb} /api/${clean}`);
    const parts = clean.split("/");
    if (parts[0] !== "admin" || parts[1] !== "moderation") return notFound();
    const rest = parts.slice(2);
    const route = `${verb} ${rest
      .map((part, index) => (index === 0 || ["evidence", "review", "resolve", "remove", "restore", "suspend", "reinstate"].includes(part) ? part : ":"))
      .join("/")}`;
    const known = [
      "GET capabilities",
      "GET reports",
      "GET reports/:",
      "POST reports/:/evidence",
      "POST reports/:/review",
      "POST reports/:/resolve",
      "POST listings/:/:/remove",
      "POST listings/:/:/restore",
      "POST users/:/suspend",
      "POST users/:/reinstate",
      "GET actions",
    ];
    if (!known.includes(route)) return notFound();

    const identity = identify(token);
    if (identity.status) return identity;

    if (route === "GET capabilities") return capabilities();
    if (route === "GET reports") return listReports(query);
    if (route === "GET actions") return listActions(query);
    if (rest[0] === "reports") {
      const found = findReport(rest[1]);
      if (found.error) return found.error;
      if (route === "GET reports/:") return ok(detail(found.report), "Report fetched successfully");
      if (rest[2] === "evidence") return openEvidence(found.report, identity.id);
      if (rest[2] === "review") return startReview(found.report, identity.id);
      return resolve(found.report, identity.id, body);
    }
    if (rest[0] === "listings") return moderateListing(rest[1], rest[2], rest[3], identity.id, body);
    return setSuspended(rest[1], rest[2] === "suspend", identity.id, body);
  }

  return { request, state };
}

/** Accounts the fixtures use on both sides of most reports, for tests that need to name them. */
export const FIXTURE_ACCOUNTS = { reporter: BUYER, reported: SELLER };
