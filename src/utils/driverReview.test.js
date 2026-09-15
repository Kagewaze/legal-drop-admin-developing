import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_FILTERS,
  apiErrorMessage,
  rejectionReasonError,
  reviewActions,
  reviewDecisionBody,
  reviewStatusOf,
  ridersUrl,
} from "./driverReview.js";

test("list filtering sends reviewStatus for each status and nothing for All", () => {
  assert.equal(ridersUrl({ page: 2, limit: 10, filter: "all" }), "admin/riders?page=2&limit=10");
  for (const [value] of REVIEW_FILTERS.filter(([v]) => v !== "all")) {
    assert.equal(ridersUrl({ page: 1, limit: 10, filter: value }), `admin/riders?page=1&limit=10&reviewStatus=${value}`);
  }
  assert.equal(ridersUrl({ filter: "not-a-status" }), "admin/riders?page=1&limit=10");
});

test("list rows show the server review status, falling back to activated only for older servers", () => {
  assert.equal(reviewStatusOf({ reviewStatus: "pending", activated: false }), "pending");
  assert.equal(reviewStatusOf({ reviewStatus: "rejected", activated: false }), "rejected");
  assert.equal(reviewStatusOf({ activated: true }), "approved");
  assert.equal(reviewStatusOf({ activated: false }), "incomplete");
  assert.equal(reviewStatusOf(null), "incomplete");
});

test("detail actions follow the committed application", () => {
  const complete = { missingRequirements: [] };
  assert.deepEqual(reviewActions({ ...complete, status: "pending" }), { canApprove: true, canReject: true });
  assert.deepEqual(reviewActions({ ...complete, status: "approved" }), { canApprove: false, canReject: true });
  assert.deepEqual(reviewActions({ ...complete, status: "rejected" }), { canApprove: true, canReject: false });
  assert.deepEqual(reviewActions({ status: "incomplete", missingRequirements: ["vehicle"] }), {
    canApprove: false,
    canReject: false,
  });
  // Missing requirements block approval even for a pending row, and no data means no actions.
  assert.equal(reviewActions({ status: "pending", missingRequirements: ["licenseBack"] }).canApprove, false);
  assert.deepEqual(reviewActions(undefined), { canApprove: false, canReject: false });
});

test("reject requires a bounded reason", () => {
  assert.match(rejectionReasonError(""), /required/);
  assert.match(rejectionReasonError("   "), /required/);
  assert.match(rejectionReasonError(undefined), /required/);
  assert.match(rejectionReasonError("x".repeat(501)), /under 500/);
  assert.equal(rejectionReasonError("Licence photo is blurry"), null);
});

test("decision bodies carry staleness guards and never send a reason on approve", () => {
  const application = { status: "pending", submittedAt: "2026-09-15T10:00:00.000Z" };
  assert.deepEqual(reviewDecisionBody(application, true, "ignored"), {
    approved: true,
    expectedStatus: "pending",
    expectedSubmittedAt: "2026-09-15T10:00:00.000Z",
  });
  assert.deepEqual(reviewDecisionBody({ status: "approved", submittedAt: null }, false, "  Insurance lapsed "), {
    approved: false,
    rejectionReason: "Insurance lapsed",
    expectedStatus: "approved",
    expectedSubmittedAt: null,
  });
});

test("error state surfaces the server message", () => {
  assert.equal(
    apiErrorMessage({ response: { data: { message: "This driver is holding a delivery in progress." } } }),
    "This driver is holding a delivery in progress."
  );
  assert.equal(apiErrorMessage({ response: { data: { message: ["a", "b"] } } }), "a, b");
  assert.equal(apiErrorMessage(new Error("Network Error"), "Could not reach the server"), "Could not reach the server");
});
