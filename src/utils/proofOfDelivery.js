// Proof of delivery — operational view (Wave 2B.4). Pure helpers for the order detail's POD section:
// no React, no network. Everything is decided from GET admin/orders/:orderId/proof, which is behind
// AuthGuard + AdminGuard on the server.
//
// ⚠️ OPERATIONS / COMPLIANCE DATA. Exact GPS, representatives, fallback reasons and the full
// append-only audit sequence (corrections and refused PIN attempts included) are shown here and
// nowhere else. The server never sends a PIN, digest, challenge, attempt count, PIN destination or
// storage key, and nothing here asks for one.
//
// ⚠️ EVIDENCE URLS ARE SHORT-LIVED (minutes). They are fetched per view, kept only in component state
// while the viewer is open, and never written to localStorage or logged.

export const STAGE_LABELS = { PICKUP: "Pickup", DELIVERY: "Delivery" };

export const METHOD_LABELS = {
  PIN: "Verification PIN",
  FALLBACK: "Fallback",
  ATTESTATION: "Attestation",
  LEGACY: "Legacy booking code",
};

export const OUTCOME_LABELS = {
  VERIFIED: "Verified",
  PIN_REJECTED: "PIN rejected",
  PIN_LOCKED: "PIN locked",
};

export const FALLBACK_REASON_LABELS = {
  contact_did_not_receive_pin: "Contact did not receive the PIN",
  contact_unreachable: "Contact unreachable",
  incorrect_contact_information: "Incorrect contact information",
  business_reception: "Business reception",
  recipient_unavailable: "Recipient unavailable",
  no_specific_recipient: "No specific recipient",
  safe_drop_authorized: "Safe drop (requested by customer)",
  other: "Other",
};

export const STATUS_BADGE_CLASSES = {
  VERIFIED: "bg-green-100 text-green-800",
  PROOF_RECORDED: "bg-green-100 text-green-800",
  LEGACY: "bg-gray-100 text-gray-700",
  NOT_REQUIRED: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  NOT_COMPLETED: "bg-red-100 text-red-800",
  UNAVAILABLE: "bg-red-100 text-red-800",
};

export const proofUrl = (orderId) => `admin/orders/${encodeURIComponent(orderId)}/proof`;
export const proofMediaUrl = (orderId, mediaId) =>
  `admin/orders/${encodeURIComponent(orderId)}/proof/media/${encodeURIComponent(mediaId)}`;

/** "43.653200, -79.383200 (±12 m)"; null when no fix was recorded. */
export function formatLocation(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const accuracy = Number.isFinite(location.accuracy) ? ` (±${Math.round(location.accuracy)} m)` : "";
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${accuracy}`;
}

/** A Google Maps link for the recorded fix — operations only. */
export function mapsLink(location) {
  if (!formatLocation(location)) return null;
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

const who = (name, role) => (name ? [name, role].filter(Boolean).join(" · ") : null);

/** Rows for one stage of the effective proof. */
export function stageRows(stage, { formatDate }) {
  if (!stage) return [];
  const rows = [
    ["Status", stage.statusLabel ?? stage.status],
    ["Method", stage.verificationLabel ?? METHOD_LABELS[stage.verificationMethod] ?? null],
    ["Fallback reason", FALLBACK_REASON_LABELS[stage.fallbackReason] ?? stage.fallbackReason ?? null],
    ["Policy version", stage.policyVersion ?? null],
    ["Completed", stage.completedAt ? formatDate(stage.completedAt) : null],
    ["Recorded (server)", stage.recordedAt ? formatDate(stage.recordedAt) : null],
    ["Captured (device)", stage.capturedAt ? formatDate(stage.capturedAt) : null],
    ["Representative", who(stage.representativeName, stage.representativeRole)],
    ["GPS", formatLocation(stage.location)],
    ["Driver", stage.driverName ?? stage.driverUserId ?? null],
  ];
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
}

/**
 * The audit sequence, oldest first, as the server returned it. Superseded rows stay visible and say
 * what replaced them; refused PIN attempts stay visible. Nothing is hidden to simplify the view.
 */
export function timelineRows(events, { formatDate, stopNumber }) {
  return (Array.isArray(events) ? events : []).map((e) => {
    const notes = [];
    if (e.effective) notes.push("Effective proof");
    if (e.supersededByEventId) notes.push("Superseded by a correction");
    if (e.supersedesEventId) notes.push("Correction of an earlier record");
    return {
      id: e.id,
      when: e.serverTimestamp ? formatDate(e.serverTimestamp) : "-",
      stage:
        e.stage === "DELIVERY" && stopNumber(e.deliveryPointId)
          ? `Delivery · stop ${stopNumber(e.deliveryPointId)}`
          : STAGE_LABELS[e.stage] ?? e.stage,
      method: METHOD_LABELS[e.verificationMethod] ?? e.verificationMethod,
      outcome: OUTCOME_LABELS[e.outcome] ?? e.outcome,
      reason: FALLBACK_REASON_LABELS[e.fallbackReason] ?? e.fallbackReason ?? null,
      representative: who(e.representativeName, e.representativeRole),
      gps: formatLocation(e.location),
      driver: e.driverName ?? e.driverUserId ?? null,
      evidence: Array.isArray(e.evidence) ? e.evidence : [],
      superseded: Boolean(e.supersededByEventId),
      notes,
    };
  });
}

/** 1-based stop number for a delivery point id, in the order the server listed the stops. */
export function stopNumberFor(proof) {
  const ids = (proof?.deliveries ?? []).map((d) => d.deliveryPointId);
  return (deliveryPointId) => {
    const i = ids.indexOf(deliveryPointId);
    return i === -1 ? null : i + 1;
  };
}

export const evidenceLabel = (type) => (type === "SIGNATURE" ? "Signature" : "Photo");

/** Only an https URL with an expiry is shown; anything else is "temporarily unavailable". */
export function usableMediaAccess(data) {
  if (!data || typeof data.url !== "string" || !/^https:\/\//.test(data.url)) return null;
  if (typeof data.expiresAt !== "string" || Number.isNaN(Date.parse(data.expiresAt))) return null;
  return { url: data.url, expiresAt: data.expiresAt, type: data.type };
}
