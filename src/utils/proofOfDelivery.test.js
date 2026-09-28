import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatLocation,
  mapsLink,
  proofMediaUrl,
  proofUrl,
  stageRows,
  stopNumberFor,
  timelineRows,
  usableMediaAccess,
} from "./proofOfDelivery.js";

// WAVE 2B.4 — ADMIN OPERATIONAL PROOF OF DELIVERY. Fixtures are shaped exactly as
// GET admin/orders/:orderId/proof serialises buildAdminDeliveryProof.

const fmt = (iso) => `@${iso}`;
const STOP_A = "22222222-2222-4222-8222-222222222222";
const STOP_B = "33333333-3333-4333-8333-333333333333";
const GPS = { latitude: 43.6532, longitude: -79.3832, accuracy: 12 };

const stage = (over = {}) => ({
  stage: "DELIVERY",
  deliveryPointId: STOP_A,
  status: "PROOF_RECORDED",
  statusLabel: "Proof recorded",
  verificationMethod: "FALLBACK",
  verificationLabel: "Business reception",
  completedAt: "2026-09-20T15:30:00.000Z",
  recordedAt: "2026-09-20T15:29:00.000Z",
  capturedAt: "2026-09-20T15:28:30.000Z",
  representativeName: "Dana Front",
  representativeRole: "Reception",
  signatureCaptured: true,
  locationVerified: true,
  evidence: [{ mediaId: "m1", type: "SIGNATURE" }],
  fallbackReason: "business_reception",
  policyVersion: "dv-2026-09-v1",
  pinRequired: true,
  driverUserId: "d1",
  driverName: "Alex Driver",
  location: GPS,
  ...over,
});

const event = (over = {}) => ({
  id: "e1",
  stage: "DELIVERY",
  deliveryPointId: STOP_A,
  verificationMethod: "FALLBACK",
  outcome: "VERIFIED",
  policyVersion: "dv-2026-09-v1",
  pinRequired: true,
  fallbackReason: "contact_unreachable",
  representativeName: "Wrong Name",
  representativeRole: null,
  evidence: [{ mediaId: "m1", type: "PHOTO" }],
  location: GPS,
  driverUserId: "d1",
  driverName: "Alex Driver",
  serviceClass: "regular",
  serverTimestamp: "2026-09-20T15:20:00.000Z",
  captureTimestamp: null,
  supersedesEventId: null,
  supersededByEventId: null,
  effective: false,
  ...over,
});

test("routes are the admin-guarded proof endpoints", () => {
  assert.equal(proofUrl("o-1"), "admin/orders/o-1/proof");
  assert.equal(proofMediaUrl("o-1", "m-1"), "admin/orders/o-1/proof/media/m-1");
});

test("a stage shows stage, method, policy, representative, role, timestamps, exact GPS, fallback reason, driver", () => {
  const rows = Object.fromEntries(stageRows(stage(), { formatDate: fmt }));
  assert.deepEqual(rows, {
    Status: "Proof recorded",
    Method: "Business reception",
    "Fallback reason": "Business reception",
    "Policy version": "dv-2026-09-v1",
    Completed: "@2026-09-20T15:30:00.000Z",
    "Recorded (server)": "@2026-09-20T15:29:00.000Z",
    "Captured (device)": "@2026-09-20T15:28:30.000Z",
    Representative: "Dana Front · Reception",
    GPS: "43.653200, -79.383200 (±12 m)",
    Driver: "Alex Driver",
  });
  assert.equal(mapsLink(GPS), "https://www.google.com/maps?q=43.6532,-79.3832");
});

test("legacy order: completion only — no invented representative, GPS or evidence", () => {
  const rows = Object.fromEntries(
    stageRows(
      stage({
        status: "LEGACY",
        statusLabel: "Completed with standard confirmation",
        verificationMethod: "LEGACY",
        verificationLabel: "Delivery confirmation code",
        recordedAt: null,
        capturedAt: null,
        representativeName: null,
        representativeRole: null,
        fallbackReason: null,
        policyVersion: null,
        driverUserId: null,
        driverName: null,
        location: null,
        evidence: [],
      }),
      { formatDate: fmt }
    )
  );
  assert.deepEqual(Object.keys(rows), ["Status", "Method", "Completed"]);
  assert.equal(formatLocation(null), null);
});

test("audit sequence: corrections and refused attempts stay visible, with what replaced what", () => {
  const events = [
    event({ id: "e0", verificationMethod: "PIN", outcome: "PIN_REJECTED", fallbackReason: null, representativeName: null, evidence: [], location: null }),
    event({ id: "e1", supersededByEventId: "e2" }),
    event({ id: "e2", representativeName: "Right Name", supersedesEventId: "e1", effective: true }),
    event({ id: "e3", deliveryPointId: STOP_B, verificationMethod: "PIN", fallbackReason: null, effective: true }),
  ];
  const proof = { deliveries: [{ deliveryPointId: STOP_A }, { deliveryPointId: STOP_B }] };
  const rows = timelineRows(events, { formatDate: fmt, stopNumber: stopNumberFor(proof) });
  assert.deepEqual(
    rows.map((r) => [r.id, r.stage, r.method, r.outcome, r.superseded, r.notes.join("; ")]),
    [
      ["e0", "Delivery · stop 1", "Verification PIN", "PIN rejected", false, ""],
      ["e1", "Delivery · stop 1", "Fallback", "Verified", true, "Superseded by a correction"],
      ["e2", "Delivery · stop 1", "Fallback", "Verified", false, "Effective proof; Correction of an earlier record"],
      ["e3", "Delivery · stop 2", "Verification PIN", "Verified", false, "Effective proof"],
    ]
  );
  assert.equal(rows[1].representative, "Wrong Name");
  assert.equal(rows[1].reason, "Contact unreachable");
});

test("evidence access: only an https URL with an expiry is shown", () => {
  const ok = usableMediaAccess({ url: "https://api.cloudinary.com/x", expiresAt: "2026-09-20T16:05:00.000Z", type: "PHOTO" });
  assert.deepEqual(ok, { url: "https://api.cloudinary.com/x", expiresAt: "2026-09-20T16:05:00.000Z", type: "PHOTO" });
  assert.equal(usableMediaAccess({ url: "http://x", expiresAt: "2026-09-20T16:05:00.000Z" }), null);
  assert.equal(usableMediaAccess({ url: "https://x" }), null);
  assert.equal(usableMediaAccess(null), null);
});

test("the section never stores or logs signed URLs, and a proof failure never breaks the order page", () => {
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const component = readFileSync(new URL("../components/orders/proofOfDelivery.jsx", import.meta.url), "utf8");
  const util = readFileSync(new URL("./proofOfDelivery.js", import.meta.url), "utf8");
  for (const src of [component, util].map(code)) {
    assert.doesNotMatch(src, /localStorage|sessionStorage|console\./);
  }
  assert.match(component, /const RESOLVE_ALL = \{ validateStatus: \(\) => true \}/);
  assert.match(component, /Evidence temporarily unavailable/);
  assert.match(component, /Proof of delivery is temporarily unavailable\./);
  assert.match(component, /referrerPolicy="no-referrer"/);
  const single = readFileSync(new URL("../components/orders/singleOrder.jsx", import.meta.url), "utf8");
  assert.match(single, /<ProofOfDelivery orderId=\{id\} \/>/);
});
