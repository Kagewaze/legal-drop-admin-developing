/* eslint-env node */
// A local HTTP API for developing and testing the moderation dashboard in a browser.
//
//   node mock/server.js [port]            (default 4010; listens on 127.0.0.1 only)
//
// ⚠️ SYNTHETIC DATA ONLY, LOCAL ONLY. It serves the in-memory stand-in for the backend's moderation
// routes (moderationMockApi.js) and nothing real: it never contacts the backend, holds no
// credentials and stores nothing. It exists because production has no reports to build against and
// because a moderation write must never be tried out on production.
//
// Point the portal at it by serving /env.js with REACT_APP_BASE_URL = http://127.0.0.1:<port>/api/
// (a local dev-server override; public/env.js is not changed).
//
// Control, for tests and manual QA:
//   POST /__mock/reset  { "scenario": "production" | "populated" | "enforced",
//                         "fail": [{ "method": "GET", "path": "admin/moderation/reports",
//                                    "as": 500 | "network" | "platform", "times": 1 }] }
//   GET  /__mock/state  → counts of what the dashboard has caused (audit rows, evidence views, …)
import http from "node:http";
import { TOKENS } from "./moderationFixtures.js";
import { MESSAGES, createMockModerationBackend } from "./moderationMockApi.js";

export const SCENARIOS = {
  // Exactly what production answers today: every feature off, nothing filed, nothing published.
  production: { data: "empty", features: {} },
  // Reports exist; suspension enforcement is OFF, so a suspension is recorded and not enforced.
  populated: { data: "populated", features: { reporting: true, blocking: true } },
  // The same data with enforcement ON and a published policy — mocked, to exercise those states.
  enforced: {
    data: "populated",
    features: { reporting: true, blocking: true, accountEnforcement: true, termsEnforcement: true },
    policies: { acceptable_use: "2026-11-01", terms_of_service: "3" },
  },
};

const LOGINS = {
  "admin@example.invalid": TOKENS.admin,
  "customer@example.invalid": TOKENS.customer,
  "former-admin@example.invalid": TOKENS.formerAdmin,
  "expired@example.invalid": TOKENS.expired,
};

const emptyPage = { page: 1, limit: 10, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false };
// Just enough of the portal's other routes for its existing pages to render empty, so navigation
// around the new section can be checked. Nothing here imitates real data.
const OTHER_ROUTES = {
  "admin/stats": { totalUsers: 0, totalOrders: 0, totalPendingOrders: 0, totalCompletedOrders: 0, totalRiders: 0 },
};

const PLATFORM_PAGE =
  "<!DOCTYPE html><html><body><h1>Error code: 503</h1><p>via_upstream (503 -) App Platform failed to forward this request to the application.</p></body></html>";

export function createMockServer({ scenario = "populated" } = {}) {
  let current = scenario;
  let backend = createMockModerationBackend(SCENARIOS[current]);
  let failures = [];

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Expose-Headers": "Cache-Control, Content-Type",
  };
  const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { ...cors, "Content-Type": "application/json; charset=utf-8", ...extra });
    res.end(JSON.stringify(body));
  };

  function state() {
    const count = (action) => backend.state.actions.filter((row) => row.action === action).length;
    return {
      scenario: current,
      features: backend.state.features,
      reports: backend.state.reports.length,
      auditRows: backend.state.actions.length,
      evidenceViews: count("evidence_viewed"),
      listingRemovals: count("listing_removed"),
      suspensions: count("account_suspended"),
      requests: backend.state.requests.reduce((tally, line) => ({ ...tally, [line]: (tally[line] ?? 0) + 1 }), {}),
      pendingFailures: failures.length,
    };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return json(res, 400, { success: false, statusCode: 400, message: "Unexpected token in JSON" });
    }

    if (url.pathname === "/__mock/state") return json(res, 200, state());
    if (url.pathname === "/__mock/reset" && req.method === "POST") {
      if (body?.scenario && !SCENARIOS[body.scenario]) return json(res, 400, { message: "unknown scenario" });
      current = body?.scenario ?? current;
      backend = createMockModerationBackend(SCENARIOS[current]);
      failures = Array.isArray(body?.fail) ? body.fail.map((rule) => ({ times: 1, ...rule })) : [];
      return json(res, 200, state());
    }
    if (!url.pathname.startsWith("/api/")) return json(res, 404, { success: false, statusCode: 404, message: "Not found" });

    const path = url.pathname.slice("/api/".length).replace(/\/+$/, "");
    const rule = failures.find((item) => item.method === req.method && path.startsWith(item.path));
    if (rule) {
      rule.times -= 1;
      if (rule.times <= 0) failures = failures.filter((item) => item !== rule);
      if (rule.as === "network") return req.socket.destroy();
      if (rule.as === "platform") {
        // What DigitalOcean sends in place of an application 502/503/504: its own page, as a 504.
        res.writeHead(504, { ...cors, "Content-Type": "text/html" });
        return res.end(PLATFORM_PAGE);
      }
      return json(res, rule.as, { success: false, statusCode: rule.as, message: "Internal server error" });
    }

    if (path === "auth/login" && req.method === "POST") {
      const token = LOGINS[body?.userIdentifier];
      return token
        ? json(res, 201, { success: true, data: { accessToken: token }, message: "User login successfully" })
        : json(res, 400, { success: false, statusCode: 400, message: "Invalid credentials" });
    }

    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || undefined;
    if (path.startsWith("admin/moderation")) {
      const answer = backend.request({
        method: req.method,
        path,
        query: Object.fromEntries(url.searchParams),
        body,
        token,
      });
      return json(res, answer.status, answer.body, { "Cache-Control": "no-store" });
    }

    if (!token) return json(res, 401, { success: false, statusCode: 401, message: "Authorization header is missing" });
    if (token === TOKENS.expired) return json(res, 401, { success: false, statusCode: 401, message: "jwt expired" });

    // The portal's existing account page and its "Update status" modal (PATCH admin/user-status),
    // which shares the backend's audited writer: an administrator account cannot be given a
    // non-active status, and the refusal is a 403.
    const accounts = backend.state.accounts;
    if (path === "admin/users" && req.method === "GET" && url.searchParams.get("id")) {
      const row = accounts.find((item) => item.id === url.searchParams.get("id"));
      return json(res, 200, { success: true, data: row ? [{ ...row, email: null, phoneNumber: null }] : [], message: "ok" });
    }
    if (path === "admin/user-status" && req.method === "PATCH") {
      const row = accounts.find((item) => item.id === body?.userId);
      if (!row) return json(res, 404, { success: false, statusCode: 404, message: MESSAGES.userNotFound });
      if (row.role === "ADMIN" && body.status !== "active") {
        return json(res, 403, { success: false, statusCode: 403, message: MESSAGES.adminCannotBeSuspended });
      }
      row.status = body.status;
      return json(res, 200, { success: true, data: row, message: "User status updated successfully" });
    }

    if (req.method === "GET") {
      const data = OTHER_ROUTES[path];
      return json(res, 200, { success: true, data: data ?? [], message: "ok", ...(data ? {} : { meta: emptyPage }) });
    }
    return json(res, 404, { success: false, statusCode: 404, message: `Cannot ${req.method} /api/${path}` });
  });

  return { server, state };
}

const direct = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (direct) {
  const port = Number(process.argv[2]) || 4010;
  createMockServer().server.listen(port, "127.0.0.1", () => {
    console.log(`moderation mock API (synthetic data) on http://127.0.0.1:${port}/api/`);
  });
}
