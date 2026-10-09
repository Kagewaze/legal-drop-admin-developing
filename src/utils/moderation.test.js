/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_ACCESS_REQUIRED_MESSAGE,
  FALLBACK_VOCABULARY,
  SUSPENSION_RECORDED_NOT_ENFORCED,
  accountRestrictionView,
  actionBody,
  actionLabel,
  appliedActions,
  auditRowView,
  availableReportActions,
  buildActionQuery,
  buildReportQuery,
  classifyModerationError,
  conversationView,
  decisionFollowUp,
  decisionOptions,
  describeAccountActionResult,
  describeCapabilities,
  describeListingActionResult,
  evidenceSnapshotView,
  inDialogError,
  isUuid,
  mutationFailureNotice,
  paginationView,
  reportStage,
  reportingInactiveNotice,
  resolutionBody,
  shortId,
  validateNote,
} from "./moderation.js";
import { BUYER, SELLER, VOCABULARY, listingId, reportId } from "../../mock/moderationFixtures.js";
import { createMockModerationBackend } from "../../mock/moderationMockApi.js";
import { TOKENS } from "../../mock/moderationFixtures.js";

// Everything here is synthetic. Shapes come from the in-memory stand-in for the deployed contract
// (backend docs/admin-moderation-dashboard.md, production 071a452); nothing reaches a server.
const ask = (backend, method, path, extra = {}) =>
  backend.request({ method, path: `admin/moderation/${path}`, token: TOKENS.admin, ...extra });
const populated = (features = {}) =>
  createMockModerationBackend({ data: "populated", features: { reporting: true, blocking: true, ...features } });
const detailOf = (backend, n) => ask(backend, "GET", `reports/${reportId(n)}`).body.data;
const capabilitiesOf = (backend) => ask(backend, "GET", "capabilities").body.data;

const PRODUCTION_CAPABILITIES = capabilitiesOf(createMockModerationBackend());
const NO_REVOCATION_CLAIM = /revoked|access (is |has been )?(blocked|removed|denied)|locked out|signed out/i;

test("ids: a full UUID is recognised and shown short without losing which one it is", () => {
  assert.equal(isUuid(BUYER), true);
  for (const value of ["", "abc", `${BUYER} `, BUYER.slice(0, 35), null, undefined, 42]) assert.equal(isUuid(value), false);
  assert.equal(shortId(BUYER), "a0000011…");
  assert.equal(shortId(""), "—");
  assert.equal(shortId(null), "—");
});

test("the fallback vocabulary is the deployed one, so filters work before capabilities load", () => {
  assert.deepEqual(FALLBACK_VOCABULARY.statuses, VOCABULARY.statuses);
  assert.deepEqual(FALLBACK_VOCABULARY.reasons, VOCABULARY.reasons);
  assert.deepEqual(FALLBACK_VOCABULARY.targetTypes, VOCABULARY.targetTypes);
  assert.deepEqual(FALLBACK_VOCABULARY.listingKinds, VOCABULARY.listingKinds);
  assert.deepEqual(FALLBACK_VOCABULARY.decisions, VOCABULARY.decisions);
  assert.deepEqual(FALLBACK_VOCABULARY.subjectTypes, VOCABULARY.subjectTypes);
  assert.deepEqual(FALLBACK_VOCABULARY.actions, VOCABULARY.actions);
});

// ── the six things an operator must be able to tell apart ──

test("a report's stage is received, under review or decision recorded — never a confirmed violation by default", () => {
  assert.deepEqual(
    ["open", "in_review", "actioned", "dismissed"].map((status) => reportStage({ status }).label),
    ["Report received", "Under review", "Decision recorded", "Decision recorded"]
  );
  assert.equal(reportStage({ status: "open" }).key, "received");
  assert.match(reportStage({ status: "open" }).detail, /allegation/i);
  assert.equal(reportStage({ status: "actioned", decision: "warning_issued" }).outcome, "Upheld · Warning issued");
  assert.equal(reportStage({ status: "dismissed", decision: "no_violation" }).outcome, "Dismissed · No violation");
  assert.equal(reportStage({ status: "something_new" }).label, "Something new");
  assert.equal(reportStage(null).label, "Unknown status");
});

test("⚠️ a decision is not an action: 'content removed' with the listing still live says so", () => {
  const backend = populated();
  ask(backend, "POST", `reports/${reportId(1)}/resolve`, { body: { decision: "content_removed" } });
  const decided = detailOf(backend, 1);
  assert.equal(decided.status, "actioned");
  assert.equal(decided.target.status, "active");

  const followUp = decisionFollowUp(decided);
  assert.equal(followUp.tone, "warning");
  assert.equal(followUp.title, "Decision recorded — the listing is still live");
  assert.match(followUp.detail, /did not remove/i);
  assert.equal(appliedActions(decided).length, 0);

  ask(backend, "POST", `listings/general/${listingId(1)}/remove`, {
    body: { note: "Synthetic reason", reportId: reportId(1) },
  });
  const applied = detailOf(backend, 1);
  assert.equal(decisionFollowUp(applied).tone, "success");
  assert.equal(decisionFollowUp(applied).title, "Action applied — the listing is removed");
  assert.deepEqual(
    appliedActions(applied).map((row) => row.label),
    ["Listing removed"]
  );
});

test("⚠️ 'account suspended' as a decision says whether a suspension exists and whether it is enforced", () => {
  const off = populated();
  ask(off, "POST", `reports/${reportId(3)}/resolve`, { body: { decision: "account_suspended" } });
  assert.equal(decisionFollowUp(detailOf(off, 3)).title, "Decision recorded — no suspension is recorded for this account");

  ask(off, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason", reportId: reportId(3) } });
  const recorded = decisionFollowUp(detailOf(off, 3));
  assert.equal(recorded.tone, "warning");
  assert.equal(recorded.title, SUSPENSION_RECORDED_NOT_ENFORCED);
  assert.doesNotMatch(`${recorded.title} ${recorded.detail}`, NO_REVOCATION_CLAIM);

  const on = populated({ accountEnforcement: true });
  ask(on, "POST", `reports/${reportId(3)}/resolve`, { body: { decision: "account_suspended" } });
  ask(on, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason", reportId: reportId(3) } });
  const enforced = decisionFollowUp(detailOf(on, 3));
  assert.equal(enforced.tone, "success");
  assert.equal(enforced.title, "Action applied — the account is suspended and access is blocked");
});

test("a decision with nothing to apply, and an undecided report, need no follow-up", () => {
  const backend = populated();
  assert.equal(decisionFollowUp(detailOf(backend, 1)), null);
  assert.equal(decisionFollowUp(detailOf(backend, 5)), null);
  ask(backend, "POST", `reports/${reportId(2)}/resolve`, { body: { decision: "warning_issued" } });
  assert.equal(decisionFollowUp(detailOf(backend, 2)), null);
});

// ── recorded is not restricted ──

test("⚠️ an account's label follows accessRestricted, never the recorded status alone", () => {
  const view = (account) => accountRestrictionView(account);
  const recorded = view({ accountStatus: "blocked", accessRestricted: false, deleted: false });
  assert.equal(recorded.label, "Suspension recorded — not currently enforced");
  assert.equal(recorded.restricted, false);
  assert.match(recorded.detail, /can still sign in/);
  assert.doesNotMatch(`${recorded.label} ${recorded.detail}`, NO_REVOCATION_CLAIM);

  const restricted = view({ accountStatus: "blocked", accessRestricted: true, deleted: false });
  assert.equal(restricted.label, "Suspended — access blocked");
  assert.equal(restricted.restricted, true);

  assert.equal(view({ accountStatus: "active", accessRestricted: false, deleted: false }).label, "Active");
  assert.equal(view({ accountStatus: "inactive", accessRestricted: false, deleted: false }).label, "Inactive — no restriction");
  assert.equal(view({ accountStatus: "blocked", accessRestricted: false, deleted: true }).label, "Account deleted");
  assert.equal(view({ accountStatus: null, accessRestricted: false, deleted: true }).label, "Account no longer exists");
  assert.equal(view(null).label, "Account unavailable");
  // Whatever the row says, only accessRestricted may produce a "restricted" label.
  for (const accountStatus of ["active", "inactive", "blocked", "anything"]) {
    assert.equal(view({ accountStatus, accessRestricted: false, deleted: false }).restricted, false);
  }
});

test("⚠️ suspension with enforcement off: recorded, not enforced, and nothing claims access was revoked", () => {
  const backend = populated();
  const answer = ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } }).body.data;
  const result = describeAccountActionResult("suspend", answer);

  assert.equal(result.title, "Suspension recorded — not currently enforced.");
  assert.equal(result.title, SUSPENSION_RECORDED_NOT_ENFORCED);
  assert.equal(result.tone, "warning");
  assert.match(result.warning, /could take effect if enforcement is activated later/);
  assert.deepEqual(result.facts, [
    ["Recorded status", "Blocked"],
    ["Previous status", "Active"],
    ["Enforcement enabled", "No"],
    ["Access actually restricted", "No"],
    ["Changed by this action", "Yes"],
  ]);
  assert.doesNotMatch(JSON.stringify(result), NO_REVOCATION_CLAIM);
});

test("suspension with enforcement on (mocked): the account is suspended and access is blocked", () => {
  const backend = populated({ accountEnforcement: true });
  const answer = ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } }).body.data;
  const result = describeAccountActionResult("suspend", answer);
  assert.equal(result.title, "Account suspended — access is blocked");
  assert.equal(result.tone, "success");
  assert.equal(result.warning, null);
  assert.deepEqual(result.facts.slice(2, 4), [
    ["Enforcement enabled", "Yes"],
    ["Access actually restricted", "Yes"],
  ]);
});

test("repeating a suspension changes nothing and says so; reinstatement is described by what is enforced", () => {
  const backend = populated();
  ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } });
  const again = ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } }).body.data;
  const repeated = describeAccountActionResult("suspend", again);
  assert.equal(repeated.title, "No change — a suspension was already recorded. It is not currently enforced.");
  assert.equal(repeated.facts[4][1], "No — it was already recorded");

  const reinstated = ask(backend, "POST", `users/${SELLER}/reinstate`, { body: { note: "Synthetic reason" } }).body.data;
  assert.equal(describeAccountActionResult("reinstate", reinstated).title, "Reinstatement recorded — suspension is not currently enforced.");

  const on = populated({ accountEnforcement: true });
  ask(on, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } });
  const restored = ask(on, "POST", `users/${SELLER}/reinstate`, { body: { note: "Synthetic reason" } }).body.data;
  assert.equal(describeAccountActionResult("reinstate", restored).title, "Account reinstated — access restored");
  assert.equal(describeAccountActionResult("suspend", null).tone, "error");
});

// ── listings ──

test("a listing action reports previous status, current status and whether anything changed", () => {
  const backend = populated();
  const body = { note: "Synthetic reason", reportId: reportId(7) };
  const removed = ask(backend, "POST", `listings/general/${listingId(3)}/remove`, { body }).body.data;
  assert.deepEqual(describeListingActionResult("remove", removed), {
    tone: "success",
    title: "Listing removed",
    facts: [
      ["Previous status", "Sold"],
      ["Current status", "Removed"],
      ["Changed by this action", "Yes"],
    ],
  });

  const repeat = ask(backend, "POST", `listings/general/${listingId(3)}/remove`, { body }).body.data;
  assert.equal(describeListingActionResult("remove", repeat).title, "No change — the listing was already removed");
  assert.equal(describeListingActionResult("remove", repeat).tone, "info");

  // ⚠️ Restored to what it was — sold — not to active by assumption.
  const restored = ask(backend, "POST", `listings/general/${listingId(3)}/restore`, { body }).body.data;
  const view = describeListingActionResult("restore", restored);
  assert.equal(view.title, "Listing restored to: Sold");
  assert.deepEqual(view.facts.slice(0, 2), [
    ["Previous status", "Removed"],
    ["Current status", "Sold"],
  ]);

  const untouched = ask(backend, "POST", `listings/general/${listingId(1)}/restore`, { body }).body.data;
  assert.equal(describeListingActionResult("restore", untouched).title, "No change — the listing is not removed (Active)");
});

test("what can be done about a report follows its state, its target and the reported account", () => {
  const backend = populated();
  const listing = availableReportActions(detailOf(backend, 1));
  assert.equal(listing.canStartReview, true);
  assert.equal(listing.canResolve, true);
  assert.equal(listing.canViewConversation, false);
  assert.deepEqual(listing.listing, { kind: "general", id: listingId(1), status: "active", canRemove: true, canRestore: false });
  assert.deepEqual(listing.account, { id: SELLER, canSuspend: true, canReinstate: false });

  const message = availableReportActions(detailOf(backend, 2));
  assert.equal(message.canViewConversation, true);
  assert.equal(message.listing, null);

  const underReview = availableReportActions(detailOf(backend, 3));
  assert.equal(underReview.canStartReview, false);
  assert.equal(underReview.canResolve, true);

  const resolved = availableReportActions(detailOf(backend, 4));
  assert.equal(resolved.canStartReview, false);
  assert.equal(resolved.canResolve, false);
  assert.deepEqual(resolved.listing, { kind: "vehicle", id: listingId(2), status: "removed", canRemove: false, canRestore: true });

  assert.equal(availableReportActions(detailOf(backend, 9)).account, null, "a deleted account has nothing to suspend");
  ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } });
  assert.deepEqual(availableReportActions(detailOf(backend, 1)).account, { id: SELLER, canSuspend: false, canReinstate: true });
  assert.deepEqual(availableReportActions(null), {
    canStartReview: false,
    canResolve: false,
    canViewConversation: false,
    listing: null,
    account: null,
  });
});

// ── feature states ──

test("⚠️ production today: everything is DISABLED except recording a suspension, which is only AVAILABLE", () => {
  const view = describeCapabilities(PRODUCTION_CAPABILITIES);
  assert.deepEqual(
    view.rows.map((row) => [row.key, row.state]),
    [
      ["reporting", "DISABLED"],
      ["blocking", "DISABLED"],
      ["suspensionRecording", "AVAILABLE"],
      ["suspensionEnforcement", "DISABLED"],
      ["terms", "DISABLED"],
    ]
  );
  assert.equal(view.enforcementOff, true);
  assert.equal(view.reportingOff, true);
  assert.match(view.rows[3].detail, /can still sign in/);
  assert.deepEqual(
    view.policies.map((policy) => [policy.label, policy.state, policy.version]),
    [
      ["Terms of service", "NOT PUBLISHED", null],
      ["Acceptable use", "NOT PUBLISHED", null],
    ]
  );
  assert.doesNotMatch(JSON.stringify(view), /SAFETY_|_ENABLED|process\.env|environment variable/i);
});

test("each switch is described by what it actually does when on", () => {
  const backend = createMockModerationBackend({
    features: { reporting: true, blocking: true, accountEnforcement: true, termsEnforcement: true },
    policies: { acceptable_use: "2026-11-01" },
  });
  const view = describeCapabilities(capabilitiesOf(backend));
  assert.deepEqual(
    view.rows.map((row) => row.state),
    ["AVAILABLE", "ENFORCED", "AVAILABLE", "ENFORCED", "ENFORCED"]
  );
  assert.equal(view.enforcementOff, false);
  assert.match(view.rows[4].detail, /2026-11-01/);
  assert.deepEqual(view.policies[1], { policyId: "acceptable_use", label: "Acceptable use", state: "PUBLISHED", version: "2026-11-01" });
});

test("terms: the switch alone requires nothing, and a published version alone is only available", () => {
  const switchOnly = describeCapabilities(capabilitiesOf(createMockModerationBackend({ features: { termsEnforcement: true } })));
  assert.equal(switchOnly.rows[4].state, "DISABLED");
  assert.match(switchOnly.rows[4].detail, /no policy version is published/);

  const publishedOnly = describeCapabilities(
    capabilitiesOf(createMockModerationBackend({ policies: { acceptable_use: "2026-11-01" } }))
  );
  assert.equal(publishedOnly.rows[4].state, "AVAILABLE");
  assert.match(publishedOnly.rows[4].detail, /not required/);
  assert.equal(describeCapabilities(null), null);
  assert.equal(describeCapabilities({}), null);
});

test("⚠️ reporting off: an empty queue is explained, and never read as 'no violations'", () => {
  const notice = reportingInactiveNotice(PRODUCTION_CAPABILITIES);
  assert.equal(notice.title, "Customer reporting is not active yet");
  assert.match(notice.detail, /does not mean there have been no policy violations/);
  assert.equal(reportingInactiveNotice(capabilitiesOf(populated())), null);
  assert.equal(reportingInactiveNotice(null), null);
});

// ── requests ──

test("queue filters become exactly the documented query, and a partial account ID is never sent", () => {
  assert.deepEqual(buildReportQuery({}), { valid: true, errors: {}, params: { page: 1, limit: 10, order: "DESC" } });
  assert.deepEqual(
    buildReportQuery({
      status: "open",
      targetType: "message",
      reason: "harassment",
      reportedUserId: ` ${SELLER} `,
      reporterUserId: BUYER,
      order: "ASC",
      page: 3,
      limit: 25,
    }).params,
    {
      status: "open",
      targetType: "message",
      reason: "harassment",
      reportedUserId: SELLER,
      reporterUserId: BUYER,
      order: "ASC",
      page: 3,
      limit: 25,
    }
  );

  const invalid = buildReportQuery({ reportedUserId: "aaaaaaaa", reporterUserId: "not an id", status: "all" });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors), ["reportedUserId", "reporterUserId"]);
  assert.deepEqual(invalid.params, { page: 1, limit: 10, order: "DESC" });

  assert.equal(buildReportQuery({ limit: 500 }).params.limit, 50);
  assert.equal(buildReportQuery({ limit: 0, page: -4 }).params.limit, 10);
  assert.equal(buildReportQuery({ limit: 0, page: -4 }).params.page, 1);
  assert.equal(buildReportQuery({ order: "sideways" }).params.order, "DESC");
  assert.equal(buildReportQuery({ status: "bogus" }).params.status, "bogus", "an unknown value is the backend's to refuse");
});

test("audit filters become exactly the documented query", () => {
  assert.deepEqual(buildActionQuery({}), { valid: true, errors: {}, params: { page: 1, limit: 10, order: "DESC" } });
  assert.deepEqual(
    buildActionQuery({ reportId: reportId(4), subjectType: "listing", subjectId: listingId(2), actorUserId: BUYER, limit: 50 }).params,
    { reportId: reportId(4), subjectType: "listing", subjectId: listingId(2), actorUserId: BUYER, page: 1, limit: 50, order: "DESC" }
  );
  const invalid = buildActionQuery({ reportId: "x", subjectId: "y", actorUserId: "z" });
  assert.deepEqual(Object.keys(invalid.errors), ["reportId", "subjectId", "actorUserId"]);
  assert.equal(invalid.valid, false);
});

test("⚠️ an optional note that is empty is never sent; a required reason is trimmed and bounded", () => {
  assert.deepEqual(resolutionBody("no_violation", ""), { decision: "no_violation" });
  assert.deepEqual(resolutionBody("no_violation", "   \n "), { decision: "no_violation" });
  assert.deepEqual(resolutionBody("no_violation", undefined), { decision: "no_violation" });
  assert.deepEqual(resolutionBody("duplicate", "  same as an earlier report "), { decision: "duplicate", note: "same as an earlier report" });

  assert.deepEqual(actionBody("  Synthetic reason ", reportId(1)), { note: "Synthetic reason", reportId: reportId(1) });
  assert.deepEqual(actionBody("Synthetic reason", null), { note: "Synthetic reason" });

  assert.deepEqual(validateNote("", { required: true }), { ok: false, trimmed: "", count: 0, error: "A reason is required." });
  assert.deepEqual(validateNote("   ", { required: false }), { ok: true, trimmed: "", count: 0, error: "" });
  assert.equal(validateNote("x".repeat(2000), { required: true }).ok, true);
  const tooLong = validateNote("x".repeat(2001), { required: true });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.error, "Keep this to 2000 characters or fewer.");
  assert.equal(validateNote("abc", { required: true, max: 2 }).ok, false);
});

// ── errors ──

test("⚠️ every failure is classified, and a 403 is never silent", () => {
  const error = (status, data) => ({ response: { status, data } });
  const envelope = (status, message, details) => ({ success: false, statusCode: status, message, ...(details ? { details } : {}) });

  assert.deepEqual(classifyModerationError(error(401, envelope(401, "jwt expired"))), {
    kind: "session",
    status: 401,
    code: null,
    message: "Your session has ended. Sign in again to continue.",
  });
  const denied = classifyModerationError(error(403, envelope(403, ADMIN_ACCESS_REQUIRED_MESSAGE)));
  assert.equal(denied.kind, "forbidden");
  assert.match(denied.message, /restricted to current administrators/);

  const refused = classifyModerationError(
    error(403, envelope(403, "Administrator accounts cannot be suspended. Remove the administrator role first."))
  );
  assert.equal(refused.kind, "refused");
  assert.equal(refused.message, "Administrator accounts cannot be suspended. Remove the administrator role first.");

  assert.equal(classifyModerationError(error(403, {})).kind, "forbidden");
  assert.equal(
    classifyModerationError(error(403, envelope(403, "Reporting is not available yet.", { code: "FEATURE_DISABLED", feature: "reporting" }))).kind,
    "feature_disabled"
  );
  assert.equal(classifyModerationError(error(404, envelope(404, "Report not found"))).kind, "not_found");
  assert.equal(classifyModerationError(error(404, envelope(404, "Report not found"))).message, "Report not found");
  assert.equal(classifyModerationError(error(409, envelope(409, "This report has already been resolved."))).kind, "conflict");
  assert.equal(classifyModerationError(error(400, envelope(400, "limit must not be greater than 50"))).kind, "invalid");
  assert.equal(classifyModerationError(error(400, { message: ["a", "b"] })).message, "a. b");
});

test("a failure with no readable answer never guesses: network, platform page, mutation result unknown", () => {
  const network = classifyModerationError(new TypeError("Cannot destructure property 'status' of 'error?.response'"));
  assert.equal(network.kind, "network");
  assert.match(network.message, /could not be reached/);

  // DigitalOcean replaces a 502/503/504 with an HTML page: there is no JSON message to show.
  const platform = classifyModerationError({ response: { status: 504, data: "<html>Error code: 503</html>" } });
  assert.equal(platform.kind, "server");
  assert.doesNotMatch(platform.message, /html/i);

  const unknown = classifyModerationError({ response: { status: 500, data: {} } }, { mutation: true });
  assert.match(unknown.message, /Result unknown/);
  assert.match(classifyModerationError(new Error("Network Error"), { mutation: true }).message, /Result unknown/);
  // Nothing from the response body other than its message and code is carried along.
  const leaky = classifyModerationError({ response: { status: 400, data: { message: "bad", secret: "do-not-copy", details: { code: "X", extra: "do-not-copy" } } } });
  assert.deepEqual(leaky, { kind: "invalid", status: 400, code: "X", message: "bad" });
});

test("⚠️ after a failed write: a decision's 409 is explained and closes the dialog; a refusal stays where it was caused", () => {
  const conflict = { kind: "conflict", message: "This report has already been resolved." };
  const refused = { kind: "refused", message: "Administrator accounts cannot be suspended. Remove the administrator role first." };

  assert.deepEqual(mutationFailureNotice(conflict, { resolving: true }), {
    tone: "warning",
    title: "This report has already been resolved",
    detail: "Another administrator may have recorded a decision first. The latest state has been loaded below.",
  });
  assert.equal(inDialogError("resolve", conflict), "");
  assert.equal(inDialogError("resolve", { kind: "invalid", message: "note should not be empty" }), "note should not be empty");

  // The administrator-protection refusal is shown in the confirmation, word for word.
  assert.equal(inDialogError("account", refused), refused.message);
  assert.equal(inDialogError("listing", { kind: "conflict", message: "not removed by a moderator" }), "not removed by a moderator");
  assert.equal(inDialogError("listing", { kind: "not_found", message: "Listing not found" }), "Listing not found");
  for (const kind of ["session", "forbidden", "network", "server", "unexpected"]) {
    assert.equal(inDialogError("account", { kind, message: "x" }), "", kind);
  }
  assert.equal(inDialogError("account", null), "");
  assert.deepEqual(mutationFailureNotice({ kind: "server", message: "Result unknown" }), {
    tone: "error",
    title: "The action was not completed",
    detail: "Result unknown",
  });
  assert.equal(mutationFailureNotice(conflict).tone, "error", "a 409 on an action is a failure, not a resolved report");
});

// ── evidence, conversation, audit ──

test("the snapshot the reporter submitted is described per target, with only https links", () => {
  const backend = populated();
  const listing = evidenceSnapshotView(detailOf(backend, 1));
  assert.equal(listing.kind, "listing");
  assert.equal(listing.title, "Synthetic listing: folding bike");
  assert.equal(listing.statusWhenReported, "Active");
  assert.equal(listing.photos.length, 2);

  const message = evidenceSnapshotView(detailOf(backend, 2));
  assert.equal(message.kind, "message");
  assert.match(message.body, /Synthetic reported message/);
  assert.equal(message.sourceLabel, "Marketplace chat");
  assert.equal(message.attachmentCount, 0);

  assert.deepEqual(evidenceSnapshotView(detailOf(backend, 3)), { kind: "account" });
  const unsafe = evidenceSnapshotView({
    targetType: "listing",
    evidence: { title: "x", photos: ["javascript:alert(1)", "http://insecure.invalid/a.jpg", "https://example.invalid/ok.jpg", 7] },
  });
  assert.deepEqual(unsafe.photos, ["https://example.invalid/ok.jpg"]);
  assert.equal(evidenceSnapshotView({ targetType: "listing" }).title, null);
});

test("a conversation names who sent each message relative to the report, and marks the reported one", () => {
  const backend = populated();
  const report = detailOf(backend, 2);
  const evidence = ask(backend, "POST", `reports/${reportId(2)}/evidence`).body.data;
  const view = conversationView(evidence, report);

  assert.equal(view.sourceLabel, "Marketplace chat");
  assert.equal(view.messages.length, 14);
  assert.deepEqual([...new Set(view.messages.map((message) => message.roleLabel))].sort(), ["Reported account", "Reporter"]);
  const reported = view.messages.filter((message) => message.reported);
  assert.equal(reported.length, 1);
  assert.equal(reported[0].role, "reported");
  assert.equal(reported[0].roleLabel, "Reported account");
  assert.equal(view.messages.find((message) => message.attachmentCount === 1).attachmentLinks.length, 1);

  const stranger = conversationView({ source: "dropbatch", messages: [{ id: "m", senderUserId: "someone-else", body: "x", createdAt: "t" }] }, report);
  assert.equal(stranger.messages[0].roleLabel, "Other participant");
  assert.deepEqual(conversationView({ source: "marketplace", messages: [] }, report).messages, []);
  assert.deepEqual(conversationView(null, report).messages, []);
});

test("an audit row is summarised without its free text; only known metadata is shown", () => {
  const backend = populated();
  const rows = ask(backend, "GET", "actions", { query: { limit: 50, order: "ASC" } }).body.data.map(auditRowView);
  const removed = rows.find((row) => row.actionLabel === "Listing removed");
  assert.equal(removed.subjectLabel, "Listing · Vehicle listing");
  assert.equal(removed.details, "Active → Removed");
  assert.equal(removed.hasNote, true);
  assert.equal("note" in removed, false);
  assert.equal(rows.find((row) => row.actionLabel === "Decision recorded: upheld").details, "Decision: Content removed");
  assert.equal(rows.find((row) => row.actionLabel === "Decision recorded: dismissed").details, "Decision: No violation");

  assert.equal(auditRowView({ action: "evidence_viewed", metadata: { source: "dropbatch" } }).details, "Source: DropBatch thread");
  assert.equal(auditRowView({ action: "listing_restored", metadata: { status: "sold" } }).details, "Removed → Sold");
  assert.equal(auditRowView({ action: "account_suspended", metadata: { previousStatus: "active", status: "blocked" } }).details, "Active → Blocked");
  assert.equal(auditRowView({ action: "account_suspended", metadata: { internal: "do-not-show" } }).details, "");
  // ⚠️ The audit action records that a suspension was written — not that access was restricted.
  assert.equal(actionLabel("account_suspended"), "Account suspension recorded");
  assert.equal(actionLabel("account_reinstated"), "Account reinstatement recorded");
  assert.equal(actionLabel("evidence_viewed"), "Conversation evidence viewed");
  assert.equal(actionLabel("brand_new_action"), "Brand new action");
});

test("decisions are offered in the backend's two groups, from capabilities or the fallback", () => {
  const groups = decisionOptions(PRODUCTION_CAPABILITIES);
  assert.deepEqual(
    groups.map((group) => [group.outcome, group.options.map((option) => option.label)]),
    [
      ["actioned", ["Content removed", "Account suspended", "Warning issued"]],
      ["dismissed", ["No violation", "Insufficient evidence", "Duplicate report"]],
    ]
  );
  assert.deepEqual(decisionOptions(null), groups);
});

test("paging reads the backend's metadata, including the empty case", () => {
  assert.deepEqual(paginationView({ page: 2, limit: 10, itemCount: 23, pageCount: 3, hasPreviousPage: true, hasNextPage: true }), {
    page: 2,
    pageCount: 3,
    itemCount: 23,
    from: 11,
    to: 20,
    hasPages: true,
  });
  assert.deepEqual(paginationView({ page: 1, limit: 1, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false }), {
    page: 1,
    pageCount: 0,
    itemCount: 0,
    from: 0,
    to: 0,
    hasPages: false,
  });
  assert.equal(paginationView({ page: 3, limit: 10, itemCount: 23, pageCount: 3 }).to, 23);
  assert.equal(paginationView(null).itemCount, 0);
});
