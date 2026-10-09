// The moderation routes, as functions that never throw.
//
// Every function answers `{ ok: true, data, meta, message }` or `{ ok: false, error }`, where
// `error` is classifyModerationError's `{ kind, status, code, message }`. A page therefore has to
// handle a refusal to compile its own happy path — including a 403, which the portal's shared
// client does not announce.
//
// ⚠️ NOTHING HERE IS CACHED OR STORED. Reports, evidence and capabilities live in the component
// that asked and nowhere else: no localStorage, no module-level copy, no logging.
//
// ⚠️ READS AND WRITES ARE SEPARATE ON PURPOSE. A read that is already in flight is shared, so a
// re-render or a development double-mount asks once. A write is never shared or repeated here: one
// call is one request, and `createOnce` is how a page makes one deliberate action one call.
//
// `client` is the portal's HTTP client (utils/customFetch) or anything with the same get/post.
import {
  FALLBACK_VOCABULARY,
  MODERATION_BASE,
  actionBody,
  buildActionQuery,
  buildReportQuery,
  classifyModerationError,
  isUuid,
  resolutionBody,
  validateNote,
} from "./moderation.js";

const failure = (kind, message, extra = {}) => ({ ok: false, error: { kind, status: null, code: null, message, ...extra } });
const NOT_FOUND = { report: "Report not found", listing: "Listing not found", user: "User not found" };

function success(response) {
  const body = response?.data;
  // The documented envelope: { success: true, data, message, meta? }. Anything else is not trusted.
  if (!body || typeof body !== "object" || body.success !== true || !("data" in body)) {
    return failure("unexpected", "The moderation service returned an unexpected answer. Nothing was shown from it.");
  }
  return { ok: true, data: body.data, meta: body.meta ?? null, message: typeof body.message === "string" ? body.message : "" };
}

export function createModerationApi(client) {
  const inFlight = new Map();

  function read(url, params) {
    const key = `${url}?${JSON.stringify(params ?? {})}`;
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = (async () => {
      try {
        return success(await client.get(url, params ? { params } : undefined));
      } catch (error) {
        return { ok: false, error: classifyModerationError(error) };
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, pending);
    return pending;
  }

  async function write(url, body) {
    try {
      return success(await client.post(url, body));
    } catch (error) {
      return { ok: false, error: classifyModerationError(error, { mutation: true }) };
    }
  }

  function list(path, query) {
    if (!query.valid) return Promise.resolve(failure("invalid", "Correct the highlighted filters.", { fields: query.errors }));
    return read(`${MODERATION_BASE}/${path}`, query.params);
  }

  /** A reason-required action on a listing or an account. Nothing is sent without a valid reason. */
  function act(url, note, reportId) {
    const reason = validateNote(note, { required: true });
    if (!reason.ok) return Promise.resolve(failure("invalid", reason.error));
    if (reportId && !isUuid(reportId)) return Promise.resolve(failure("not_found", NOT_FOUND.report));
    return write(url, actionBody(note, reportId));
  }

  const reportUrl = (reportId, suffix = "") => `${MODERATION_BASE}/reports/${reportId}${suffix}`;
  // An ID that is not a UUID is never put in a URL: the answer could only be "not found".
  const forReport = (reportId, request) =>
    isUuid(reportId) ? request() : Promise.resolve(failure("not_found", NOT_FOUND.report));

  function listing(verb, kind, listingId, note, reportId) {
    if (!FALLBACK_VOCABULARY.listingKinds.includes(kind)) {
      return Promise.resolve(failure("invalid", "This kind of listing cannot be moderated here."));
    }
    if (!isUuid(listingId)) return Promise.resolve(failure("not_found", NOT_FOUND.listing));
    return act(`${MODERATION_BASE}/listings/${kind}/${listingId}/${verb}`, note, reportId);
  }

  function account(verb, userId, note, reportId) {
    if (!isUuid(userId)) return Promise.resolve(failure("not_found", NOT_FOUND.user));
    return act(`${MODERATION_BASE}/users/${userId}/${verb}`, note, reportId);
  }

  return {
    /** GET capabilities — which safety features are on. Read-only. */
    getCapabilities: () => read(`${MODERATION_BASE}/capabilities`),
    /** GET reports — the queue: identifiers only, no content. */
    listReports: (filters) => list("reports", buildReportQuery(filters)),
    /** GET reports/:id — the report, both accounts, the target and its history. */
    getReport: (reportId) => forReport(reportId, () => read(reportUrl(reportId))),
    /**
     * POST reports/:id/evidence — the surrounding private conversation.
     * ⚠️ EVERY CALL WRITES AN AUDIT ROW NAMING THE ADMINISTRATOR. Call it only from a deliberate
     * action, wrapped in createOnce; never from an effect, a hover or a render.
     */
    openEvidence: (reportId) => forReport(reportId, () => write(reportUrl(reportId, "/evidence"))),
    /** POST reports/:id/review — received → under review. */
    startReview: (reportId) => forReport(reportId, () => write(reportUrl(reportId, "/review"))),
    /** POST reports/:id/resolve — records a decision. It removes nothing and suspends nobody. */
    resolveReport: (reportId, decision, note) =>
      forReport(reportId, () => {
        const text = validateNote(note);
        if (!text.ok) return Promise.resolve(failure("invalid", text.error));
        return write(reportUrl(reportId, "/resolve"), resolutionBody(decision, note));
      }),
    removeListing: (kind, listingId, note, reportId) => listing("remove", kind, listingId, note, reportId),
    restoreListing: (kind, listingId, note, reportId) => listing("restore", kind, listingId, note, reportId),
    suspendAccount: (userId, note, reportId) => account("suspend", userId, note, reportId),
    reinstateAccount: (userId, note, reportId) => account("reinstate", userId, note, reportId),
    /** GET actions — the audit trail. There is deliberately nothing here that changes a row. */
    listActions: (filters) => list("actions", buildActionQuery(filters)),
  };
}

/**
 * One deliberate action → at most one call. The returned function runs `request` the first time
 * and hands every later caller the same answer: a double click, a re-render or a repeated key
 * press cannot send a second request. A new deliberate action needs a new createOnce.
 */
export function createOnce(request) {
  let pending = null;
  return function run() {
    if (!pending) pending = Promise.resolve().then(request);
    return pending;
  };
}

/**
 * Runs a write, then reloads — whether it succeeded or not. After a conflict or an unknown result
 * the page must show what is true now, not what it showed before. A failed reload never hides the
 * write's own answer.
 */
export async function runMutation(request, reload) {
  const result = await request();
  let reloaded = true;
  try {
    await reload?.();
  } catch {
    reloaded = false;
  }
  return { ...result, reloaded };
}

const COUNTED = ["open", "in_review", "actioned", "dismissed"];

/**
 * The overview: capabilities, the four counts and the latest audit rows.
 * Counts are the queue's own `meta.itemCount` for one-row pages — there is no analytics route.
 */
export async function loadOverview(api) {
  const [capabilities, recent, ...counted] = await Promise.all([
    api.getCapabilities(),
    api.listActions({ limit: 5 }),
    ...COUNTED.map((status) => api.listReports({ status, limit: 1 })),
  ]);
  const failed = [capabilities, recent, ...counted].find((result) => !result.ok);
  return {
    capabilities: capabilities.ok ? capabilities.data : null,
    counts: Object.fromEntries(
      COUNTED.map((status, index) => [status, counted[index].ok ? (counted[index].meta?.itemCount ?? null) : null])
    ),
    recent: recent.ok && Array.isArray(recent.data) ? recent.data : [],
    error: failed ? failed.error : null,
  };
}
