/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";

import { createModerationApi, createOnce, loadOverview, runMutation } from "./moderationApi.js";
import { SUSPENSION_RECORDED_NOT_ENFORCED, describeAccountActionResult } from "./moderation.js";
import {
  BUYER,
  DRIVER,
  SECOND_ADMIN,
  SELLER,
  TOKENS,
  listingId,
  reportId,
} from "../../mock/moderationFixtures.js";
import { MESSAGES, createMockModerationBackend } from "../../mock/moderationMockApi.js";

// The API layer against an in-memory stand-in for the deployed contract (backend
// docs/admin-moderation-dashboard.md, production 071a452). The client below behaves like the
// portal's axios instance: it resolves `{ status, data }` and rejects `{ response }` for a refusal.
// Synthetic data only; nothing reaches a server.
function harness({ data = "populated", features = { reporting: true, blocking: true }, token = TOKENS.admin, policies } = {}) {
  const backend = createMockModerationBackend({ data, features, policies });
  const calls = [];
  let failure = null;
  const send = async (method, url, { params, body } = {}) => {
    calls.push({ method, url, params, body });
    if (failure) throw failure;
    const answer = backend.request({ method, path: url, query: params ?? {}, body, token });
    if (answer.status >= 400) throw { response: { status: answer.status, data: answer.body } };
    return { status: answer.status, data: answer.body };
  };
  const client = {
    get: (url, config) => send("GET", url, { params: config?.params }),
    post: (url, body) => send("POST", url, { body }),
  };
  return {
    backend,
    calls,
    api: createModerationApi(client),
    failWith: (error) => {
      failure = error;
    },
    lines: () => calls.map((call) => `${call.method} ${call.url}`),
    auditRows: () => backend.state.actions.length,
  };
}
const production = () => harness({ data: "empty", features: {} });
const REASON = "Synthetic reason";

test("1 · production today: empty queue, empty audit trail, every feature off — with read-only requests", async () => {
  const { api, lines, auditRows } = production();
  const overview = await loadOverview(api);

  assert.deepEqual(overview.counts, { open: 0, in_review: 0, actioned: 0, dismissed: 0 });
  assert.deepEqual(overview.capabilities.features, {
    reporting: false,
    blocking: false,
    accountEnforcement: false,
    termsEnforcement: false,
  });
  assert.deepEqual(overview.recent, []);
  assert.equal(overview.error, null);
  // Counts come from the queue's own paging metadata: four requests of one row each. No new API.
  assert.deepEqual(lines().sort(), [
    "GET admin/moderation/actions",
    "GET admin/moderation/capabilities",
    "GET admin/moderation/reports",
    "GET admin/moderation/reports",
    "GET admin/moderation/reports",
    "GET admin/moderation/reports",
  ]);
  assert.equal(auditRows(), 0);

  const queue = await api.listReports({});
  assert.equal(queue.ok, true);
  assert.deepEqual(queue.data, []);
  assert.deepEqual(queue.meta, { page: 1, limit: 10, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false });
});

test("1b · ⚠️ counts are the backend's totals, not the size of the one-row pages they are read from", async () => {
  const { api, calls } = harness();
  const overview = await loadOverview(api);
  assert.deepEqual(overview.counts, { open: 20, in_review: 1, actioned: 1, dismissed: 1 });
  assert.equal(overview.recent.length, 5);
  assert.equal(overview.capabilities.features.reporting, true);
  assert.equal(overview.error, null);
  // One row per count request: the number comes from `meta.itemCount`.
  const counted = calls.filter((call) => call.url === "admin/moderation/reports");
  assert.deepEqual(counted.map((call) => [call.params.status, call.params.limit]).sort(), [
    ["actioned", 1],
    ["dismissed", 1],
    ["in_review", 1],
    ["open", 1],
  ]);
});

test("2 · the queue pages with the backend's metadata and never asks for more than 50", async () => {
  const { api, calls } = harness();
  const first = await api.listReports({});
  assert.equal(first.data.length, 10);
  assert.deepEqual([first.meta.itemCount, first.meta.pageCount, first.meta.hasNextPage], [23, 3, true]);
  const last = await api.listReports({ page: 3 });
  assert.equal(last.data.length, 3);
  assert.equal(last.meta.hasNextPage, false);
  assert.deepEqual(Object.keys(first.data[0]).sort(), [
    "createdAt",
    "decision",
    "id",
    "reason",
    "reportedUserId",
    "reporterUserId",
    "resolvedAt",
    "status",
    "targetId",
    "targetKind",
    "targetType",
  ]);

  await api.listReports({ limit: 500 });
  assert.equal(calls.at(-1).params.limit, 50);
  assert.equal((await api.listReports({ limit: 50 })).data.length, 23);
});

test("3 · filters: status, target, reason, accounts and order — and a partial ID sends nothing", async () => {
  const { api, calls } = harness();
  assert.equal((await api.listReports({ status: "open" })).meta.itemCount, 20);
  assert.equal((await api.listReports({ targetType: "message" })).meta.itemCount, 2);
  assert.equal((await api.listReports({ reason: "harassment" })).meta.itemCount, 4);
  assert.equal((await api.listReports({ reportedUserId: DRIVER })).meta.itemCount, 1);
  assert.equal((await api.listReports({ reporterUserId: DRIVER })).meta.itemCount, 4);
  const oldest = await api.listReports({ order: "ASC", limit: 1 });
  assert.equal(oldest.data[0].id, reportId(1));
  assert.equal((await api.listReports({ status: "open", reason: "hate", targetType: "listing" })).meta.itemCount, 0);

  const before = calls.length;
  const partial = await api.listReports({ reportedUserId: "aaaaaaaa" });
  assert.equal(partial.ok, false);
  assert.equal(partial.error.kind, "invalid");
  assert.deepEqual(Object.keys(partial.error.fields), ["reportedUserId"]);
  assert.equal(calls.length, before, "nothing was requested");

  const refused = await api.listReports({ status: "bogus" });
  assert.equal(refused.error.kind, "invalid");
  assert.match(refused.error.message, /status must be one of the following values/);
});

test("4 · a report's detail carries the allegation, the snapshot, both accounts, the target and the history", async () => {
  const { api, lines, auditRows } = harness();
  const before = auditRows();
  const { ok, data } = await api.getReport(reportId(4));
  assert.equal(ok, true);
  assert.equal(data.status, "actioned");
  assert.deepEqual(data.reporter, { id: BUYER, name: "Bao Yang", accountStatus: "active", accessRestricted: false, deleted: false });
  assert.deepEqual(data.reported.reports, { total: 20, actioned: 1 });
  assert.deepEqual(data.target, { exists: true, title: "Synthetic listing: cargo van", status: "removed" });
  assert.deepEqual(
    data.history.map((row) => row.action),
    ["report_review_started", "listing_removed", "report_actioned"]
  );
  assert.deepEqual(lines(), [`GET admin/moderation/reports/${reportId(4)}`]);
  assert.equal(auditRows(), before, "reading a report writes nothing");

  const unknown = await api.getReport(reportId(999));
  assert.equal(unknown.error.kind, "not_found");
  assert.equal(unknown.error.message, MESSAGES.reportNotFound);
  const garbage = await api.getReport("../../users");
  assert.equal(garbage.error.kind, "not_found");
  assert.equal(lines().length, 2, "an ID that is not a UUID is never put in a URL");
});

test("5 · ⚠️ conversation evidence is one audited POST per deliberate action — never on load, never twice", async () => {
  const { api, lines, auditRows, backend } = harness();
  const before = auditRows();
  await api.getReport(reportId(2));
  await api.listReports({});
  await api.getCapabilities();
  assert.equal(auditRows(), before, "loading the report, the queue or capabilities opens no evidence");
  assert.equal(lines().filter((line) => line.startsWith("POST")).length, 0);

  // One deliberate action, triggered three times (double click, re-render): one request.
  const view = createOnce(() => api.openEvidence(reportId(2)));
  const [first, second, third] = await Promise.all([view(), view(), view()]);
  assert.equal(first, second);
  assert.equal(first, third);
  assert.equal(first.ok, true);
  assert.equal(first.data.messages.length, 14);
  assert.equal(first.data.messages.filter((message) => message.reported).length, 1);
  assert.equal(await view(), first, "asking again after it settled does not request again");
  assert.deepEqual(lines().filter((line) => line.startsWith("POST")), [`POST admin/moderation/reports/${reportId(2)}/evidence`]);
  assert.equal(auditRows(), before + 1);
  assert.equal(backend.state.actions.at(-1).action, "evidence_viewed");

  // Viewing again is a new deliberate action, and is recorded again.
  await createOnce(() => api.openEvidence(reportId(2)))();
  assert.equal(auditRows(), before + 2);

  const notMessage = await api.openEvidence(reportId(1));
  assert.equal(notMessage.error.kind, "invalid");
  assert.equal(notMessage.error.message, MESSAGES.notAMessage);
  assert.equal(auditRows(), before + 2, "a refused request records nothing");
});

test("6 · review moves a received report to under review, once", async () => {
  const { api, auditRows } = harness();
  const before = auditRows();
  const started = await api.startReview(reportId(1));
  assert.equal(started.ok, true);
  assert.equal(started.data.status, "in_review");
  assert.equal(started.message, "Report is under review");
  assert.equal((await api.startReview(reportId(1))).data.status, "in_review");
  assert.equal(auditRows(), before + 1);
});

test("7 · ⚠️ a decision is recorded with exactly what was chosen; an empty note is not sent", async () => {
  const { api, calls } = harness();
  const dismissed = await api.resolveReport(reportId(1), "no_violation", "   ");
  assert.deepEqual(calls.at(-1), {
    method: "POST",
    url: `admin/moderation/reports/${reportId(1)}/resolve`,
    params: undefined,
    body: { decision: "no_violation" },
  });
  assert.equal(dismissed.ok, true);
  assert.deepEqual([dismissed.data.status, dismissed.data.decision, dismissed.data.resolutionNote], ["dismissed", "no_violation", null]);

  const upheld = await api.resolveReport(reportId(2), "warning_issued", "  Synthetic note ");
  assert.deepEqual(calls.at(-1).body, { decision: "warning_issued", note: "Synthetic note" });
  assert.equal(upheld.data.status, "actioned");
  // The decision did not remove or suspend anything.
  assert.deepEqual(
    upheld.data.history.map((row) => row.action),
    ["report_actioned"]
  );
});

test("8 · ⚠️ a report someone else resolved first: 409, and the latest state is reloaded", async () => {
  const { api, backend } = harness();
  backend.request({
    method: "POST",
    path: `admin/moderation/reports/${reportId(1)}/resolve`,
    body: { decision: "duplicate" },
    token: TOKENS.admin,
  });
  let reloads = 0;
  const outcome = await runMutation(
    () => api.resolveReport(reportId(1), "content_removed", ""),
    async () => {
      reloads += 1;
    }
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.kind, "conflict");
  assert.equal(outcome.error.message, MESSAGES.alreadyResolved);
  assert.equal(reloads, 1);
  assert.equal(outcome.reloaded, true);
  assert.equal((await api.getReport(reportId(1))).data.decision, "duplicate", "the first decision stands");
  assert.equal((await api.startReview(reportId(1))).error.kind, "conflict");

  // A reload that fails must not hide what the request returned.
  const hidden = await runMutation(
    () => api.startReview(reportId(3)),
    async () => {
      throw new Error("reload failed");
    }
  );
  assert.equal(hidden.ok, true);
  assert.equal(hidden.reloaded, false);
});

test("9 · removing a listing from a report puts the action in that report's history", async () => {
  const { api, calls } = harness();
  const removed = await api.removeListing("general", listingId(1), REASON, reportId(1));
  assert.deepEqual(calls.at(-1), {
    method: "POST",
    url: `admin/moderation/listings/general/${listingId(1)}/remove`,
    params: undefined,
    body: { note: REASON, reportId: reportId(1) },
  });
  assert.deepEqual(removed.data, {
    listingId: listingId(1),
    listingKind: "general",
    status: "removed",
    previousStatus: "active",
    changed: true,
  });
  const detail = (await api.getReport(reportId(1))).data;
  assert.equal(detail.target.status, "removed");
  assert.deepEqual(
    detail.history.map((row) => [row.action, row.note]),
    [["listing_removed", REASON]]
  );

  const before = calls.length;
  assert.equal((await api.removeListing("general", listingId(1), "   ", reportId(1))).error.kind, "invalid");
  assert.equal((await api.removeListing("boat", listingId(1), REASON, reportId(1))).error.kind, "invalid");
  assert.equal(calls.length, before, "no reason or an unknown kind: nothing is sent");
  assert.equal((await api.removeListing("general", listingId(77), REASON, reportId(1))).error.message, MESSAGES.listingNotFound);
});

test("10 · ⚠️ restoring returns a listing to the status it had — sold stays sold", async () => {
  const { api } = harness();
  await api.removeListing("general", listingId(3), REASON, reportId(7));
  const restored = await api.restoreListing("general", listingId(3), REASON, reportId(7));
  assert.deepEqual([restored.data.status, restored.data.previousStatus, restored.data.changed], ["sold", "removed", true]);

  const notOurs = await api.restoreListing("general", listingId(4), REASON, null);
  assert.equal(notOurs.error.kind, "conflict");
  assert.equal(notOurs.error.message, MESSAGES.notModeratorRemoved);
});

test("11 · ⚠️ suspension with enforcement off is recorded, not enforced — and the page can say exactly that", async () => {
  const { api, calls } = harness();
  const answer = await api.suspendAccount(SELLER, REASON, reportId(3));
  assert.deepEqual(calls.at(-1).body, { note: REASON, reportId: reportId(3) });
  assert.deepEqual(answer.data, {
    userId: SELLER,
    status: "blocked",
    previousStatus: "active",
    changed: true,
    enforced: false,
    accessRestricted: false,
  });
  assert.equal(answer.message, MESSAGES.suspendedRecordedOnly);
  assert.equal(describeAccountActionResult("suspend", answer.data).title, SUSPENSION_RECORDED_NOT_ENFORCED);

  const detail = (await api.getReport(reportId(3))).data;
  assert.deepEqual([detail.reported.accountStatus, detail.reported.accessRestricted], ["blocked", false]);
});

test("12 · suspension with enforcement on (mocked data): the account is actually restricted", async () => {
  const { api } = harness({ features: { reporting: true, accountEnforcement: true } });
  const answer = await api.suspendAccount(SELLER, REASON, reportId(3));
  assert.deepEqual([answer.data.enforced, answer.data.accessRestricted], [true, true]);
  assert.equal(answer.message, MESSAGES.suspendedAndEnforced);
  assert.equal((await api.getReport(reportId(3))).data.reported.accessRestricted, true);
});

test("13 · reinstatement records the previous status and whether anything changed", async () => {
  const { api } = harness();
  await api.suspendAccount(SELLER, REASON, null);
  const reinstated = await api.reinstateAccount(SELLER, REASON, null);
  assert.deepEqual(reinstated.data, {
    userId: SELLER,
    status: "active",
    previousStatus: "blocked",
    changed: true,
    enforced: false,
    accessRestricted: false,
  });
  assert.equal((await api.reinstateAccount(SELLER, REASON, null)).data.changed, false);
});

test("14 · 17 · ⚠️ a non-administrator and a former administrator are refused everywhere, loudly, and nothing changes", async () => {
  for (const token of [TOKENS.customer, TOKENS.formerAdmin]) {
    const { api, auditRows, backend } = harness({ token });
    const before = auditRows();
    const answers = [
      await api.getCapabilities(),
      await api.listReports({}),
      await api.getReport(reportId(1)),
      await api.listActions({}),
      await api.openEvidence(reportId(2)),
      await api.startReview(reportId(1)),
      await api.resolveReport(reportId(1), "no_violation", ""),
      await api.removeListing("general", listingId(1), REASON, null),
      await api.suspendAccount(SELLER, REASON, null),
    ];
    for (const answer of answers) {
      assert.equal(answer.ok, false);
      assert.equal(answer.error.kind, "forbidden");
      assert.match(answer.error.message, /restricted to current administrators/);
    }
    assert.equal(auditRows(), before);
    assert.equal(backend.state.reports.find((row) => row.id === reportId(1)).status, "open");
  }
  const overview = await loadOverview(harness({ token: TOKENS.customer }).api);
  assert.equal(overview.error.kind, "forbidden");
  assert.equal(overview.capabilities, null);
});

test("14b · ⚠️ the backend's refusal to suspend an administrator reaches the page as its own message", async () => {
  const { api, auditRows } = harness();
  const before = auditRows();
  const refused = await api.suspendAccount(SECOND_ADMIN, REASON, reportId(8));
  assert.equal(refused.ok, false);
  assert.equal(refused.error.kind, "refused");
  assert.equal(refused.error.message, MESSAGES.adminCannotBeSuspended);
  assert.equal(auditRows(), before);
});

test("15 · an expired session is reported as a session that ended", async () => {
  const { api } = harness({ token: TOKENS.expired });
  for (const answer of [await api.listReports({}), await api.suspendAccount(SELLER, REASON, null)]) {
    assert.equal(answer.error.kind, "session");
    assert.equal(answer.error.message, "Your session has ended. Sign in again to continue.");
  }
  assert.equal((await loadOverview(api)).error.kind, "session");
});

test("16 · a request that fails outright never throws and never pretends: network, platform page, unknown result", async () => {
  const { api, failWith } = harness();
  failWith(new TypeError("Cannot destructure property 'status' of 'error?.response' as it is undefined."));
  const offline = await api.listReports({});
  assert.equal(offline.error.kind, "network");
  assert.match((await api.resolveReport(reportId(1), "no_violation", "")).error.message, /Result unknown/);

  failWith({ response: { status: 504, data: "<html><body>Error code: 503</body></html>" } });
  const platform = await api.getReport(reportId(1));
  assert.equal(platform.error.kind, "server");
  assert.match((await api.suspendAccount(SELLER, REASON, null)).error.message, /Result unknown/);
  const overview = await loadOverview(api);
  assert.equal(overview.error.kind, "server");
  assert.deepEqual(overview.counts, { open: null, in_review: null, actioned: null, dismissed: null });
});

test("a 200 that is not the documented envelope is not trusted", async () => {
  const api = createModerationApi({
    get: async () => ({ status: 200, data: "<html>not json</html>" }),
    post: async () => ({ status: 200, data: { success: false } }),
  });
  assert.equal((await api.getCapabilities()).error.kind, "unexpected");
  assert.equal((await api.startReview(reportId(1))).error.kind, "unexpected");
});

test("18 · the audit trail lists what was written, filtered and paged like the queue", async () => {
  const { api, calls } = harness();
  await api.removeListing("general", listingId(1), REASON, reportId(1));
  const all = await api.listActions({ limit: 50, order: "ASC" });
  assert.equal(all.meta.itemCount, 6);
  assert.deepEqual(Object.keys(all.data[0]).sort(), [
    "action",
    "actorUserId",
    "createdAt",
    "id",
    "metadata",
    "note",
    "reportId",
    "subjectId",
    "subjectKind",
    "subjectType",
  ]);
  assert.equal((await api.listActions({ subjectType: "listing" })).meta.itemCount, 2);
  assert.equal((await api.listActions({ reportId: reportId(4) })).meta.itemCount, 3);
  assert.equal((await api.listActions({ actorUserId: SECOND_ADMIN })).meta.itemCount, 1);
  assert.equal((await api.listActions({ subjectType: "listing", subjectId: listingId(1) })).meta.itemCount, 1);
  const before = calls.length;
  assert.equal((await api.listActions({ subjectId: "short" })).error.kind, "invalid");
  assert.equal(calls.length, before);
  // The audit trail is read-only here: the API layer has no way to change or delete a row.
  assert.deepEqual(
    Object.keys(api).filter((name) => /delete|update|edit|patch|put/i.test(name)),
    []
  );
});

test("identical reads in flight share one request (a re-render or a double mount asks once)", async () => {
  const { api, lines } = harness();
  const [a, b] = await Promise.all([api.getReport(reportId(1)), api.getReport(reportId(1))]);
  assert.equal(a, b);
  await Promise.all([api.listReports({ status: "open" }), api.listReports({ status: "open" }), api.getCapabilities(), api.getCapabilities()]);
  assert.deepEqual(lines(), [
    `GET admin/moderation/reports/${reportId(1)}`,
    "GET admin/moderation/reports",
    "GET admin/moderation/capabilities",
  ]);
  // …but a later read asks again: nothing is cached.
  await api.getCapabilities();
  assert.equal(lines().length, 4);
});

test("every operation maps to exactly the deployed route", async () => {
  const { api, lines } = harness();
  await api.getCapabilities();
  await api.listReports({});
  await api.getReport(reportId(2));
  await api.openEvidence(reportId(2));
  await api.startReview(reportId(2));
  await api.resolveReport(reportId(2), "duplicate", "");
  await api.removeListing("vehicle", listingId(2), REASON, null);
  await api.restoreListing("vehicle", listingId(2), REASON, null);
  await api.suspendAccount(SELLER, REASON, null);
  await api.reinstateAccount(SELLER, REASON, null);
  await api.listActions({});
  assert.deepEqual(lines(), [
    "GET admin/moderation/capabilities",
    "GET admin/moderation/reports",
    `GET admin/moderation/reports/${reportId(2)}`,
    `POST admin/moderation/reports/${reportId(2)}/evidence`,
    `POST admin/moderation/reports/${reportId(2)}/review`,
    `POST admin/moderation/reports/${reportId(2)}/resolve`,
    `POST admin/moderation/listings/vehicle/${listingId(2)}/remove`,
    `POST admin/moderation/listings/vehicle/${listingId(2)}/restore`,
    `POST admin/moderation/users/${SELLER}/suspend`,
    `POST admin/moderation/users/${SELLER}/reinstate`,
    "GET admin/moderation/actions",
  ]);
});
