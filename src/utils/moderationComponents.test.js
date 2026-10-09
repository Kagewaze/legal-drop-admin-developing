/* eslint-env node */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

import { SELLER, TOKENS, reportId } from "../../mock/moderationFixtures.js";
import { createMockModerationBackend } from "../../mock/moderationMockApi.js";

// THE MODERATION SCREENS, RENDERED. Same approach as orderCancellation.test.js: each component is
// compiled with the project's own esbuild and rendered to markup with synthetic data, and the HTTP
// client is replaced by one that fails the test if anything requests while rendering.
// Interactions (one audited request per confirmation, reload after every write) are covered in
// moderationApi.test.js and were exercised in a browser against mock/server.js.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const requested = [];
const STUBS = {
  "utils/customFetch.js": {
    default: {
      get: (url) => {
        requested.push(`GET ${url}`);
        throw new Error("render must not request");
      },
      post: (url) => {
        requested.push(`POST ${url}`);
        throw new Error("render must not request");
      },
    },
  },
  "utils/context.jsx": { useGlobalContext: () => ({ setGlobalLoading: () => {} }) },
};

const compiled = new Map();
const loaded = new Map();
const relative = (file) => path.relative(SRC, file).replaceAll("\\", "/");
function resolveFile(from, request) {
  const base = path.resolve(path.dirname(from), request);
  for (const candidate of [base, `${base}.jsx`, `${base}.js`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`cannot resolve ${request} from ${relative(from)}`);
}
async function compile(file) {
  if (compiled.has(file) || relative(file) in STUBS) return;
  const { code } = await transformWithEsbuild(readFileSync(file, "utf8"), file, {
    loader: file.endsWith(".jsx") ? "jsx" : "js",
    format: "cjs",
    jsx: "automatic",
  });
  compiled.set(file, code);
  for (const [, request] of code.matchAll(/require\("(\.[^"]+)"\)/g)) await compile(resolveFile(file, request));
}
function load(file) {
  const key = relative(file);
  if (key in STUBS) return STUBS[key];
  if (loaded.has(file)) return loaded.get(file).exports;
  const module = { exports: {} };
  loaded.set(file, module);
  new Function("require", "module", "exports", compiled.get(file))(
    (request) => (request.startsWith(".") ? load(resolveFile(file, request)) : require(request)),
    module,
    module.exports
  );
  return module.exports;
}
async function component(name) {
  const file = path.join(SRC, name);
  await compile(file);
  return load(file);
}

// The server router: links render as plain anchors and nothing subscribes to history.
const { StaticRouter } = require("react-router-dom/server");
const html = (type, props) =>
  renderToStaticMarkup(React.createElement(StaticRouter, { location: "/moderation" }, React.createElement(type, props)));
const count = (markup, needle) => markup.split(needle).length - 1;

const { CapabilityPanel, EnforcementNotice } = await component("components/moderation/capabilityPanel.jsx");
const { OverviewBody } = await component("components/moderation/overview.jsx");
const { ReportQueueBody, ReportFilters } = await component("components/moderation/reportQueue.jsx");
const { AuditBody, HistoryList } = await component("components/moderation/auditViews.jsx");
const detail = await component("components/moderation/reportDetail.jsx");
const { ConversationEvidence, ConversationMessages } = await component("components/moderation/conversationEvidence.jsx");
const dialogs = await component("components/moderation/actionDialogs.jsx");
const { ErrorState } = await component("components/moderation/ui.jsx");
const { UpdateStatus } = await component("components/updateStatus.jsx");
const logic = await component("utils/moderation.js");
const apiLayer = await component("utils/moderationApi.js");

// Synthetic data from the in-memory stand-in for the deployed contract.
const ask = (backend, method, route, extra = {}) =>
  backend.request({ method, path: `admin/moderation/${route}`, token: TOKENS.admin, ...extra });
const world = (options) => createMockModerationBackend(options);
const populated = (features = {}) => world({ data: "populated", features: { reporting: true, blocking: true, ...features } });
const capabilitiesOf = (backend) => ask(backend, "GET", "capabilities").body.data;
const reportOf = (backend, n) => ask(backend, "GET", `reports/${reportId(n)}`).body.data;
const listOf = (backend, route, query = {}) => {
  const { body } = ask(backend, "GET", route, { query });
  return { ok: true, data: body.data, meta: body.meta, message: body.message };
};
const PRODUCTION = capabilitiesOf(world());
const ENFORCED = capabilitiesOf(
  world({ features: { reporting: true, blocking: true, accountEnforcement: true, termsEnforcement: true }, policies: { acceptable_use: "2026-11-01" } })
);
const REVOCATION_CLAIM = /revoked|access (is |has been )?(blocked|removed|denied)|locked out|signed out/i;
const noop = () => {};

const moderationFiles = [
  ...readdirSync(path.join(SRC, "components/moderation")).map((name) => `components/moderation/${name}`),
  ...readdirSync(path.join(SRC, "pages")).filter((name) => name.startsWith("moderation")).map((name) => `pages/${name}`),
  "utils/moderation.js",
  "utils/moderationApi.js",
];
// Line endings differ between checkouts; the assertions below must not.
const sourceOf = (name) => readFileSync(path.join(SRC, name), "utf8").replaceAll("\r\n", "\n");

test("the stand-in answers capabilities exactly as production does today", () => {
  // Recorded read-only from production (backend 071a452) on 2026-10-09: the canonical JSON of the
  // capabilities `data` hashed to this, and it matched the example in the backend's specification.
  const canon = (value) =>
    Array.isArray(value)
      ? value.map(canon)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canon(value[key])]))
        : value;
  const digest = createHash("sha256").update(JSON.stringify(canon(PRODUCTION))).digest("hex");
  assert.equal(digest.slice(0, 16), "61714247df8d3ab6");

  // …and the empty queue and audit trail in the same envelope production returned.
  for (const route of ["reports", "actions"]) {
    const { body } = ask(world(), "GET", route, { query: { limit: 1 } });
    assert.deepEqual(Object.keys(body).sort(), ["data", "message", "meta", "success"]);
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.meta, { page: 1, limit: 1, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false });
  }
});

// ── feature states ──

test("⚠️ the feature panel shows DISABLED · AVAILABLE · ENFORCED and has nothing to switch", () => {
  const off = html(CapabilityPanel, { capabilities: PRODUCTION });
  assert.equal(count(off, ">DISABLED<"), 4);
  assert.equal(count(off, ">AVAILABLE<"), 1);
  assert.equal(count(off, ">ENFORCED<"), 0);
  assert.equal(count(off, ">NOT PUBLISHED<"), 2);
  assert.match(off, /This screen cannot change any of it/);
  assert.match(off, /A recorded suspension does not restrict access: the account can still sign in\./);
  // Read-only: no control of any kind, and nothing about how the service is configured.
  assert.doesNotMatch(off, /<(button|input|select|textarea)\b|role="switch"|type="checkbox"/);
  assert.doesNotMatch(off, /SAFETY_|_ENABLED|process\.env|environment/i);

  const on = html(CapabilityPanel, { capabilities: ENFORCED });
  assert.equal(count(on, ">ENFORCED<"), 3);
  assert.equal(count(on, ">AVAILABLE<"), 2);
  assert.match(on, /version 2026-11-01/);
  assert.match(on, />PUBLISHED</);
  assert.doesNotMatch(on, /<(button|input|select)\b/);

  assert.match(html(EnforcementNotice, { capabilities: PRODUCTION }), /Account suspension enforcement is DISABLED/);
  assert.equal(html(EnforcementNotice, { capabilities: ENFORCED }), "");
  assert.equal(html(EnforcementNotice, { capabilities: null }), "");
  assert.equal(html(CapabilityPanel, { capabilities: null }), "");
});

// ── overview ──

test("⚠️ the overview with reporting off: zero is explained, never presented as 'no violations'", async () => {
  const backend = world();
  const api = apiLayer.createModerationApi({
    get: async (url, config) => {
      const answer = backend.request({ method: "GET", path: url, query: config?.params ?? {}, token: TOKENS.admin });
      return { status: answer.status, data: answer.body };
    },
  });
  const overview = await apiLayer.loadOverview(api);
  const markup = html(OverviewBody, { loading: false, overview, onRetry: noop });

  assert.match(markup, /Customer reporting is not active yet/);
  assert.match(markup, /does not mean there have been no policy violations/);
  assert.match(markup, /Account suspension enforcement is DISABLED/);
  for (const status of ["open", "in_review", "actioned", "dismissed"]) {
    assert.match(markup, new RegExp(`href="/moderation/reports\\?status=${status}"`));
  }
  assert.equal(count(markup, 'text-gray900">0</p>'), 4);
  assert.match(markup, /No moderation action has been recorded yet\./);
  assert.match(markup, /href="\/moderation\/audit"/);
  assert.match(markup, /Safety feature status/);
  assert.doesNotMatch(markup, /no (policy )?violations (have|were)|all clear|nothing to review/i);
});

test("the overview while loading, when refused, and when part of it could not be loaded", () => {
  assert.match(html(OverviewBody, { loading: true, overview: null, onRetry: noop }), /role="status".*Loading the moderation overview/s);

  const refused = html(OverviewBody, {
    loading: false,
    onRetry: noop,
    overview: { capabilities: null, counts: {}, recent: [], error: logic.classifyModerationError({ response: { status: 403, data: { message: "Admin access required" } } }) },
  });
  assert.match(refused, /Administrator access required/);
  assert.match(refused, /No moderation data was loaded\./);
  assert.doesNotMatch(refused, /Report counts|Safety feature status|Recent moderation activity/);

  const partial = html(OverviewBody, {
    loading: false,
    onRetry: noop,
    overview: {
      capabilities: PRODUCTION,
      counts: { open: null, in_review: null, actioned: null, dismissed: null },
      recent: [],
      error: logic.classifyModerationError({ response: { status: 504, data: "<html></html>" } }),
    },
  });
  assert.match(partial, /This could not be loaded/);
  assert.match(partial, />Try again</);
  assert.equal(count(partial, 'text-gray900">—</p>'), 4, "an unknown count is a dash, never a zero");
});

// ── queue ──

test("the queue lists identifiers only: no names, no report text, one deliberate link per row", () => {
  const backend = populated();
  const markup = html(ReportQueueBody, {
    loading: false,
    result: listOf(backend, "reports"),
    capabilities: capabilitiesOf(backend),
    filtersActive: false,
    onRetry: noop,
    onPage: noop,
  });
  assert.equal(count(markup, "<tr"), 11);
  assert.match(markup, /Showing 1–10 of 23/);
  assert.match(markup, new RegExp(`href="/moderation/reports/${reportId(23)}"`));
  assert.match(markup, />Report received</);
  for (const header of ["Report", "Submitted", "Target", "Reason", "Status", "Reported account", "Listing / message", "Action"]) {
    assert.match(markup, new RegExp(`<th scope="col"[^>]*>${header}</th>`));
  }
  // The backend sends a queue row no name and no content, and none is invented or fetched.
  assert.doesNotMatch(markup, /Sela Rivers|Bao Yang|Dee Okoro|Synthetic explanation|Synthetic listing|Synthetic reported/);
  assert.doesNotMatch(markup, /<img\b/);
  assert.deepEqual(requested, []);
});

test("⚠️ an empty queue says why it is empty", () => {
  const empty = { ok: true, data: [], meta: { page: 1, limit: 10, itemCount: 0, pageCount: 0 }, message: "" };
  const render = (props) => html(ReportQueueBody, { loading: false, result: empty, onRetry: noop, onPage: noop, ...props });

  const inactive = render({ capabilities: PRODUCTION, filtersActive: false });
  assert.match(inactive, /Customer reporting is not active yet/);
  assert.match(inactive, /does not mean there have been no policy violations/);
  assert.match(render({ capabilities: PRODUCTION, filtersActive: true }), /No reports match these filters/);
  assert.match(render({ capabilities: capabilitiesOf(populated()), filtersActive: false }), /No reports have been filed/);
  assert.match(render({ capabilities: null, filtersActive: false }), /No reports have been filed/);
  for (const markup of [inactive, render({ capabilities: null, filtersActive: false })]) assert.doesNotMatch(markup, /<table/);

  assert.match(html(ReportQueueBody, { loading: true, result: null, onRetry: noop, onPage: noop }), /Loading reports/);
});

test("a refused, expired or failed queue request is always shown", () => {
  const failed = (status, message) => ({ ok: false, error: logic.classifyModerationError({ response: { status, data: { message } } }) });
  const render = (result) => html(ReportQueueBody, { loading: false, result, capabilities: null, filtersActive: false, onRetry: noop, onPage: noop });

  const denied = render(failed(403, "Admin access required"));
  assert.match(denied, /role="alert"/);
  assert.match(denied, /Administrator access required/);
  assert.match(denied, />Sign out</);
  assert.doesNotMatch(denied, /<table|Try again/);

  const expired = render(failed(401, "jwt expired"));
  assert.match(expired, /Your session has ended/);
  assert.match(expired, /href="\/login"/);

  assert.match(render(failed(500, "Internal server error")), />Try again</);
  assert.match(render({ ok: false, error: logic.classifyModerationError(new TypeError("no response")) }), /could not be reached/);
  assert.match(render({ ok: false, error: { kind: "invalid", message: "x", fields: { reportedUserId: "bad" } } }), /Correct the highlighted filters/);

  const filters = html(ReportFilters, {
    vocabulary: logic.FALLBACK_VOCABULARY,
    draft: { status: "", targetType: "", reason: "", reportedUserId: "a0000012", reporterUserId: "", order: "DESC", limit: 10 },
    errors: { reportedUserId: "Enter a complete ID (36 characters, including dashes)." },
    onChange: noop,
    onApply: noop,
    onClear: noop,
  });
  assert.match(filters, /aria-invalid="true"[^>]*aria-describedby="report-filter-reported-error"/);
  assert.match(filters, /id="report-filter-reported-error"[^>]*>Enter a complete ID/);
  for (const label of ["Status", "Target type", "Reason", "Order", "Reported account ID", "Reporter account ID", "Rows per page"]) {
    assert.match(filters, new RegExp(`<label for="[^"]+"[^>]*>${label}</label>`));
  }
});

// ── a report ──

test("⚠️ the allegation is shown as an allegation: unverified, in the reporter's words, never as a finding", () => {
  const markup = html(detail.AllegationCard, { report: reportOf(populated(), 1) });
  assert.match(markup, />Unverified</);
  assert.match(markup, /This is what the reporter says\. It has not been confirmed\./);
  assert.match(markup, /Prohibited item/);
  assert.match(markup, /Synthetic explanation: the reporter says this item is not allowed\./);
  assert.doesNotMatch(markup, /violation|confirmed that|guilty|offender/i);
  assert.match(html(detail.AllegationCard, { report: reportOf(populated(), 8) }), /The reporter gave no explanation\./);

  assert.match(html(detail.ReportStatus, { report: reportOf(populated(), 1) }), />Report received</);
  assert.match(html(detail.ReportStatus, { report: reportOf(populated(), 3) }), />Under review</);
  const decided = html(detail.ReportStatus, { report: reportOf(populated(), 4) });
  assert.match(decided, />Decision recorded</);
  assert.match(decided, /Upheld · Content removed/);
});

test("⚠️ an account's chip never contradicts accessRestricted", () => {
  const off = populated();
  ask(off, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } });
  const recorded = html(detail.AccountsCard, { report: reportOf(off, 3) });
  assert.match(recorded, /Sela Rivers/);
  assert.match(recorded, />Suspension recorded — not currently enforced</);
  assert.match(recorded, /this account can still sign in/);
  assert.doesNotMatch(recorded, REVOCATION_CLAIM);
  assert.match(recorded, /Reported 20 times in total; 1 upheld\./);

  const on = populated({ accountEnforcement: true });
  ask(on, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason" } });
  const restricted = html(detail.AccountsCard, { report: reportOf(on, 3) });
  assert.match(restricted, />Suspended — access blocked</);
  assert.doesNotMatch(restricted, /not currently enforced/);

  const gone = html(detail.AccountsCard, { report: reportOf(populated(), 9) });
  assert.match(gone, />Account deleted</);
});

test("the submitted evidence is shown without loading anything from it", () => {
  const listing = html(detail.EvidenceSnapshotCard, { report: reportOf(populated(), 1) });
  assert.match(listing, /Synthetic listing: folding bike/);
  assert.match(listing, /120\.00/);
  assert.match(listing, /2 photos captured\. Photos are not loaded/);
  assert.match(listing, />Show photo links</);
  // Reported photos are neither embedded nor linked until asked for.
  assert.doesNotMatch(listing, /<img\b|example\.invalid/);
  assert.match(listing, /The listing now/);

  const message = html(detail.EvidenceSnapshotCard, { report: reportOf(populated(), 2) });
  assert.match(message, /Marketplace chat/);
  assert.match(message, /<blockquote[^>]*>Synthetic reported message: this text is the subject of the report\./);
  assert.match(html(detail.EvidenceSnapshotCard, { report: reportOf(populated(), 3) }), /No content is captured for a report about an account\./);
});

test("⚠️ deciding is separate from acting, on the screen and in its wording", () => {
  const open = html(detail.DecisionCard, { report: reportOf(populated(), 1), capabilities: PRODUCTION, busy: false, onStartReview: noop, onRequestResolve: noop });
  assert.match(open, /It does not remove content or suspend an account/);
  assert.match(open, />Start review</);
  assert.equal(count(open, 'type="radio"'), 6);
  for (const label of ["Content removed", "Account suspended", "Warning issued", "No violation", "Insufficient evidence", "Duplicate report"]) {
    assert.match(open, new RegExp(`${label}</label>`));
  }
  assert.match(open, /<button type="submit"[^>]*disabled=""[^>]*>Record decision…<\/button>/, "nothing can be recorded before a decision is chosen");

  const reviewing = html(detail.DecisionCard, { report: reportOf(populated(), 3), capabilities: null, busy: false, onStartReview: noop, onRequestResolve: noop });
  assert.doesNotMatch(reviewing, />Start review</);
  assert.equal(count(reviewing, 'type="radio"'), 6, "the fallback vocabulary offers the same decisions");

  // Decided as "content removed" while the listing is still live.
  const backend = populated();
  ask(backend, "POST", `reports/${reportId(1)}/resolve`, { body: { decision: "content_removed" } });
  const decided = html(detail.DecisionCard, { report: reportOf(backend, 1), capabilities: PRODUCTION, busy: false, onStartReview: noop, onRequestResolve: noop });
  assert.match(decided, /Content removed/);
  assert.match(decided, /Decision recorded — the listing is still live/);
  assert.match(decided, /it is not itself an action/);
  assert.doesNotMatch(decided, /type="radio"|Record decision…/);
  assert.doesNotMatch(decided, /Listing removed|has been removed|was removed/);
});

test("⚠️ the result of a suspension says what was recorded, what is enforced and what is actually restricted", () => {
  const backend = populated();
  const answer = ask(backend, "POST", `users/${SELLER}/suspend`, { body: { note: "Synthetic reason", reportId: reportId(3) } }).body.data;
  const markup = html(detail.EnforcementCard, {
    report: reportOf(backend, 3),
    busy: false,
    result: logic.describeAccountActionResult("suspend", answer),
    onListing: noop,
    onAccount: noop,
  });
  assert.match(markup, /Suspension recorded — not currently enforced\./);
  assert.match(markup, /could take effect if enforcement is activated later/);
  for (const [label, value] of [
    ["Recorded status", "Blocked"],
    ["Previous status", "Active"],
    ["Enforcement enabled", "No"],
    ["Access actually restricted", "No"],
    ["Changed by this action", "Yes"],
  ]) {
    assert.match(markup, new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${value}</dd>`));
  }
  assert.doesNotMatch(markup, REVOCATION_CLAIM);
  assert.match(markup, />Reinstate account…</);
  assert.doesNotMatch(markup, />Record suspension…</);

  const listing = html(detail.EnforcementCard, { report: reportOf(populated(), 4), busy: false, result: null, onListing: noop, onAccount: noop });
  assert.match(listing, />Restore listing…</);
  assert.doesNotMatch(listing, />Remove listing…</);
  const deleted = html(detail.EnforcementCard, { report: reportOf(populated(), 9), busy: false, result: null, onListing: noop, onAccount: noop });
  assert.match(deleted, /There is no account to suspend or reinstate\./);
});

test("the confirmations say what will happen before it happens, as accessible dialogs", () => {
  const suspendOff = html(dialogs.AccountActionDialog, { verb: "suspend", capabilities: PRODUCTION, max: 2000, busy: false, error: "", onConfirm: noop, onClose: noop });
  assert.match(suspendOff, /role="dialog" aria-modal="true" aria-labelledby="[^"]+" aria-describedby="[^"]+"/);
  assert.match(suspendOff, /Suspension enforcement is DISABLED/);
  assert.match(suspendOff, /The account will still be able to sign in\./);
  assert.match(suspendOff, /could take effect if enforcement is activated later/);
  assert.match(suspendOff, /disabled="">Record suspension<\/button>/, "a reason is required before it can be confirmed");
  assert.doesNotMatch(suspendOff, REVOCATION_CLAIM);
  assert.match(suspendOff, /<label for="account-suspend-reason"[^>]*>Reason \(required\)<\/label>/);

  const suspendOn = html(dialogs.AccountActionDialog, { verb: "suspend", capabilities: ENFORCED, max: 2000, busy: false, error: "", onConfirm: noop, onClose: noop });
  assert.match(suspendOn, /Suspension enforcement is ENFORCED/);
  assert.match(suspendOn, />Suspend account<\/button>/);
  const unknown = html(dialogs.AccountActionDialog, { verb: "suspend", capabilities: null, max: 2000, busy: false, error: "", onConfirm: noop, onClose: noop });
  assert.match(unknown, /Enforcement state could not be confirmed/);
  assert.doesNotMatch(unknown, REVOCATION_CLAIM);

  // ⚠️ The backend's refusal to suspend an administrator is shown in the dialog, word for word.
  const refusal = "Administrator accounts cannot be suspended. Remove the administrator role first.";
  const refused = html(dialogs.AccountActionDialog, { verb: "suspend", capabilities: PRODUCTION, max: 2000, busy: false, error: refusal, onConfirm: noop, onClose: noop });
  assert.match(refused, new RegExp(`role="alert"[^>]*>${refusal}<`));

  const resolve = html(dialogs.ResolveDialog, { decision: "content_removed", note: "  ", busy: false, error: "", onConfirm: noop, onClose: noop });
  assert.match(resolve, /Content removed/);
  assert.match(resolve, /This is final\./);
  assert.match(resolve, /Recording a decision does not remove content or suspend an account\./);
  assert.match(resolve, /No note will be recorded\./);

  const restore = html(dialogs.ListingActionDialog, { verb: "restore", status: "removed", max: 2000, busy: false, error: "", onConfirm: noop, onClose: noop });
  assert.match(restore, /That is not necessarily/);
  assert.doesNotMatch(restore, /returns to active|back to active/i);
  const remove = html(dialogs.ListingActionDialog, { verb: "remove", status: "active", max: 2000, busy: true, error: "", onConfirm: noop, onClose: noop });
  assert.match(remove, /Remove this listing from Marketplace\?/);
  assert.match(remove, />Removing…<\/button>/);
});

// ── private evidence ──

test("⚠️ the private conversation is not requested, shown or prefetched when the report is rendered", () => {
  const calls = [];
  const api = { openEvidence: (id) => calls.push(id) };
  const markup = html(ConversationEvidence, { report: reportOf(populated(), 2), api, onViewed: noop });

  assert.deepEqual(calls, []);
  assert.match(markup, />View conversation evidence<\/button>/);
  assert.match(markup, /the access is recorded in the moderation audit history under your\s+administrator account/);
  assert.doesNotMatch(markup, /Synthetic message|<ol\b|role="dialog"/);

  const source = sourceOf("components/moderation/conversationEvidence.jsx");
  // Requested from the confirmation only: no effect in this file, and one call site, inside createOnce.
  assert.doesNotMatch(source, /useEffect|useLayoutEffect|onMouseEnter|onMouseOver|onFocus/);
  assert.equal(count(source, "openEvidence("), 1);
  assert.match(source, /createOnce\(\(\) => api\.openEvidence\(report\.id\)\)/);
});

test("an opened conversation marks the reported message and loads no attachment", () => {
  const backend = populated();
  const report = reportOf(backend, 2);
  const evidence = ask(backend, "POST", `reports/${reportId(2)}/evidence`).body.data;
  const markup = html(ConversationMessages, { view: logic.conversationView(evidence, report) });
  assert.equal(count(markup, "<li"), 14);
  assert.equal(count(markup, ">Reported message<"), 1);
  assert.match(markup, />Reported account</);
  assert.match(markup, />Reporter</);
  assert.match(markup, /1 attachment \(not loaded\)/);
  assert.match(markup, /target="_blank" rel="noopener noreferrer"[^>]*>Open attachment 1</);
  assert.doesNotMatch(markup, /<img\b|<video\b|<iframe\b/);
  assert.match(html(ConversationMessages, { view: logic.conversationView({ source: "marketplace", messages: [] }, report) }), /no longer available/);
});

// ── audit ──

test("⚠️ the audit trail is read-only and keeps free text out of its rows", () => {
  const backend = populated();
  const markup = html(AuditBody, { loading: false, result: listOf(backend, "actions"), filtersActive: false, onRetry: noop, onPage: noop });
  assert.equal(count(markup, "<tr"), 6);
  assert.match(markup, /Entries cannot be changed or removed\./);
  for (const header of ["When", "Action", "Administrator", "Subject", "Report", "Outcome", "Reason"]) {
    assert.match(markup, new RegExp(`<th scope="col"[^>]*>${header}</th>`));
  }
  assert.match(markup, /Decision: Content removed/);
  assert.match(markup, /Active → Removed/);
  assert.match(markup, /aria-expanded="false"[^>]*>Show reason</);
  // A reason is opened one row at a time, on request; none is printed with the table.
  assert.doesNotMatch(markup, /Synthetic (reason|note)/);
  assert.doesNotMatch(markup, />\s*(Edit|Delete|Remove|Undo)\s*</);
  assert.match(html(AuditBody, { loading: false, result: listOf(world(), "actions"), filtersActive: false, onRetry: noop, onPage: noop }), /No moderation action has been recorded yet/);

  const history = html(HistoryList, { history: reportOf(backend, 4).history });
  assert.equal(count(history, "<li"), 3);
  assert.match(history, /Listing removed/);
  assert.doesNotMatch(history, /<button[^>]*>(Edit|Delete|Remove)/);
  assert.match(html(detail.HistoryCard, { report: reportOf(backend, 1) }), /No moderation action has been recorded for this report\./);
});

// ── the existing account-status modal ──

test("⚠️ the existing 'Update status' modal no longer swallows a 403", () => {
  const markup = renderToStaticMarkup(React.createElement(UpdateStatus, { routeTitle: "user", id: SELLER, closeUpdateModal: noop, seeChangesFunction: noop }));
  assert.match(markup, /Update user status/);
  assert.doesNotMatch(markup, /role="alert"/, "nothing is shown until the backend refuses");
  const source = sourceOf("components/updateStatus.jsx");
  assert.match(source, /error\?\.response\?\.status === 403/);
  assert.match(source, /setRefusal\(\s*error\.response\.data\?\.message/);
  assert.match(source, /role="alert"/);
  // Same request and same success path as before.
  assert.match(source, /const url = `admin\/\$\{routeTitle\}-status`;/);
  assert.match(source, /customFetch\.patch\(url, formPayload\)/);
});

// ── how it is wired, and what it must never do ──

test("the dashboard is part of the existing portal: its routes, its menu, its HTTP client", () => {
  const app = sourceOf("App.jsx");
  for (const route of [
    '<Route path="moderation" element={<ModerationOverview />} />',
    '<Route path="moderation/reports" element={<ModerationReports />} />',
    '<Route path="moderation/reports/:reportId" element={<ModerationReport />} />',
    '<Route path="moderation/audit" element={<ModerationAudit />} />',
  ]) {
    assert.ok(app.includes(route), route);
  }
  // Inside the protected layout, like every other page.
  assert.ok(app.indexOf("<ProtectedRoute>") < app.indexOf('path="moderation"'));
  assert.ok(app.indexOf('path="moderation/audit"') < app.indexOf("</Route>\n        </Routes>"));
  assert.match(sourceOf("components/navBar.jsx"), /linkName: "Moderation",\s+linkUrl: "\/moderation",/);

  // One HTTP client: the portal's. No second axios instance, no fetch, no other base URL.
  assert.equal(sourceOf("components/moderation/api.js").includes('import customFetch from "../../utils/customFetch";'), true);
  for (const name of moderationFiles) {
    const source = sourceOf(name);
    assert.doesNotMatch(source, /from "axios"|axios\.create|\bfetch\(|XMLHttpRequest|REACT_APP_BASE_URL|https?:\/\//, name);
  }
});

test("⚠️ nothing sensitive is stored, logged or injected by the moderation screens", () => {
  for (const name of moderationFiles) {
    const source = sourceOf(name);
    assert.doesNotMatch(source, /console\.|sessionStorage|indexedDB|document\.cookie|dangerouslySetInnerHTML|<img\b/, name);
    assert.doesNotMatch(source, /localStorage\.setItem|localStorage\.getItem/, name);
  }
  // The only storage touched is the sign-out the navigation bar already performs.
  const storage = moderationFiles.flatMap((name) => [...sourceOf(name).matchAll(/localStorage\.\w+\([^)]*\)/g)].map((match) => `${name}: ${match[0]}`));
  assert.deepEqual(storage, [
    'components/moderation/ui.jsx: localStorage.removeItem("CRMuser")',
    'components/moderation/ui.jsx: localStorage.removeItem("CRMACCESSTOKEN")',
  ]);
  // Evidence is opened from one component only, and no page asks for it itself.
  const callers = moderationFiles.filter((name) => /\.openEvidence\(/.test(sourceOf(name)));
  assert.deepEqual(callers, ["components/moderation/conversationEvidence.jsx"]);
  // An account ID never goes into the address bar: it travels in the router's state.
  for (const name of moderationFiles) assert.doesNotMatch(sourceOf(name), /\?(reportedUserId|reporterUserId|subjectId|actorUserId)=/, name);
  assert.deepEqual(requested, [], "rendering any of the screens above requested nothing");
});

test("a refusal panel offers the right way out for each kind", () => {
  const panel = (error) => html(ErrorState, { error, onRetry: noop });
  assert.match(panel({ kind: "forbidden", message: "m" }), />Sign out</);
  assert.match(panel({ kind: "session", message: "m" }), /Go to sign-in/);
  assert.match(panel({ kind: "not_found", message: "Report not found" }), />Not found</);
  assert.doesNotMatch(panel({ kind: "not_found", message: "Report not found" }), /Try again/);
  assert.match(panel({ kind: "server", message: "m" }), /Try again/);
  assert.equal(html(ErrorState, { error: null }), "");
});
