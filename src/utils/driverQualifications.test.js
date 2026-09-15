import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  QUALIFICATION_STATUS_LABELS,
  approvalExpiryError,
  canGrantQualification,
  qualificationDecisionBody,
  qualificationGrantBody,
  qualificationRecordActions,
  rejectionReasonError,
} from "./driverReview.js";

test("status badges cover every server status, with Expired distinct from Approved", () => {
  assert.deepEqual(Object.keys(QUALIFICATION_STATUS_LABELS).sort(), [
    "approved",
    "expired",
    "not_started",
    "pending",
    "rejected",
  ]);
  assert.equal(QUALIFICATION_STATUS_LABELS.expired, "Expired");
  assert.equal(QUALIFICATION_STATUS_LABELS.not_started, "Not submitted");
});

test("record actions: pending with evidence → approve/reject; approved → revoke; expired and rejected → none", () => {
  assert.deepEqual(qualificationRecordActions({ displayStatus: "pending", documentUrl: "https://signed" }), {
    canApprove: true,
    canReject: true,
    canRevoke: false,
  });
  // No document, no Approve.
  assert.equal(qualificationRecordActions({ displayStatus: "pending", documentUrl: null }).canApprove, false);
  assert.deepEqual(qualificationRecordActions({ displayStatus: "approved", documentUrl: null }), {
    canApprove: false,
    canReject: false,
    canRevoke: true,
  });
  for (const displayStatus of ["expired", "rejected"]) {
    assert.deepEqual(qualificationRecordActions({ displayStatus, documentUrl: "https://signed" }), {
      canApprove: false,
      canReject: false,
      canRevoke: false,
    });
  }
  assert.deepEqual(qualificationRecordActions(undefined), { canApprove: false, canReject: false, canRevoke: false });
});

test("grant is offered only for Druppr's own training, and only when not currently held or pending", () => {
  assert.equal(canGrantQualification({ type: "legal_process_service", status: "not_started" }), true);
  assert.equal(canGrantQualification({ type: "legal_process_service", status: "expired" }), true);
  assert.equal(canGrantQualification({ type: "legal_process_service", status: "approved" }), false);
  assert.equal(canGrantQualification({ type: "legal_process_service", status: "pending" }), false);
  for (const type of ["tdg", "vehicle_inspector", "tow_operator"]) {
    assert.equal(canGrantQualification({ type, status: "not_started" }), false);
  }
});

test("approval expiry: required for TDG, future-only everywhere", () => {
  const today = "2026-09-15";
  assert.match(approvalExpiryError("tdg", "", today), /required/);
  assert.equal(approvalExpiryError("tow_operator", "", today), null);
  assert.match(approvalExpiryError("tdg", "2026-09-15", today), /future/);
  assert.match(approvalExpiryError("vehicle_inspector", "2020-01-01", today), /future/);
  assert.match(approvalExpiryError("tdg", "15/09/2027", today), /YYYY-MM-DD/);
  assert.equal(approvalExpiryError("tdg", "2027-09-15", today), null);
});

test("reject and revoke require a bounded reason (shared validator)", () => {
  assert.match(rejectionReasonError(" "), /required/);
  assert.equal(rejectionReasonError("Certificate is expired"), null);
});

test("decision bodies carry the staleness guard; approve never sends a reason, reject never an expiry", () => {
  const record = { id: "c1", status: "pending" };
  assert.deepEqual(qualificationDecisionBody(record, true, { expiresOn: "2027-09-15", reason: "x" }), {
    approved: true,
    expectedStatus: "pending",
    expiresAt: "2027-09-15",
  });
  assert.deepEqual(qualificationDecisionBody(record, true, {}), { approved: true, expectedStatus: "pending" });
  assert.deepEqual(
    qualificationDecisionBody({ id: "c2", status: "approved" }, false, { reason: "  Revoked after audit ", expiresOn: "2027-01-01" }),
    { approved: false, expectedStatus: "approved", rejectionReason: "Revoked after audit" }
  );
  assert.deepEqual(qualificationGrantBody("u1", "legal_process_service", ""), {
    driverUserId: "u1",
    certType: "legal_process_service",
  });
});

// Tow work needs the qualification AND a tow-capable registered vehicle, verified separately. The
// reviewing admin must be able to see both without the panel implying one verifies the other.
test("the tow card shows the registered vehicle and keeps vehicle verification separate", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const panel = fs.readFileSync(
    path.join(here, "..", "components", "riders", "qualificationsPanel.jsx"),
    "utf8"
  );
  const singleRider = fs.readFileSync(
    path.join(here, "..", "components", "riders", "singleRider.jsx"),
    "utf8"
  );

  // The vehicle is shown on the tow family only, from the server's review projection.
  assert.match(panel, /summary\.type === "tow_operator"/);
  assert.match(panel, /Registered vehicle/);
  assert.match(panel, /vehicle\?\.type/);
  assert.match(singleRider, /vehicle=\{review\.vehicle\}/);

  // It must read as a separate check, never as something approving the qualification verifies.
  assert.match(panel, /verified separately/i);

  // Approving a qualification still sends only the qualification decision — no vehicle field.
  assert.deepEqual(qualificationDecisionBody({ id: "c3", status: "pending" }, true, {}), {
    approved: true,
    expectedStatus: "pending",
  });
});
