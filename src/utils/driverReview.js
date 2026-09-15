// Driver application review — pure helpers shared by the Drivers list and the Driver detail review
// panel. No React, no network: everything here is decided from server data so the UI never guesses.

export const REVIEW_STATUS_LABELS = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  incomplete: "Incomplete",
};

export const REVIEW_BADGE_CLASSES = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  incomplete: "bg-gray-100 text-gray-700",
};

// [value, label] — "all" sends no filter.
export const REVIEW_FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["incomplete", "Incomplete"],
];

export const REQUIREMENT_LABELS = {
  vehicle: "Vehicle type",
  licenseFront: "Licence (front)",
  licenseBack: "Licence (back)",
  vehicleRegistrationNo: "Vehicle registration number",
};

export const REJECTION_REASON_MAX_LENGTH = 500;

const STATUSES = Object.keys(REVIEW_STATUS_LABELS);

// A list row carries the raw driver_info (or null for a RIDER who never saved driver info). An older
// server without reviewStatus is mapped from activated, never from UI assumptions.
export function reviewStatusOf(driver) {
  if (driver && STATUSES.includes(driver.reviewStatus)) return driver.reviewStatus;
  return driver?.activated ? "approved" : "incomplete";
}

export function ridersUrl({ page = 1, limit = 10, filter = "all" } = {}) {
  const reviewStatus = STATUSES.includes(filter) ? `&reviewStatus=${filter}` : "";
  return `admin/riders?page=${page}&limit=${limit}${reviewStatus}`;
}

// What the admin may do from the committed review projection. Mirrors the backend decision table:
// approve needs a complete, not-yet-approved application; reject applies to a pending application or
// revokes an approval. The backend still re-checks everything under a row lock.
export function reviewActions(application) {
  const status = application?.status;
  const complete = Array.isArray(application?.missingRequirements)
    ? application.missingRequirements.length === 0
    : false;
  return {
    canApprove: Boolean(status) && status !== "approved" && complete,
    canReject: status === "pending" || status === "approved",
  };
}

export function rejectionReasonError(reason) {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (!trimmed) return "A rejection reason is required. The driver will see it.";
  if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
    return `Keep the reason under ${REJECTION_REASON_MAX_LENGTH} characters.`;
  }
  return null;
}

// The decision body. expectedStatus / expectedSubmittedAt make the server refuse (409) a decision
// taken on a stale screen — another admin decided, or the driver resubmitted — instead of approving
// documents this admin never saw.
export function reviewDecisionBody(application, approved, reason) {
  return {
    approved,
    ...(approved ? {} : { rejectionReason: typeof reason === "string" ? reason.trim() : reason }),
    expectedStatus: application?.status,
    expectedSubmittedAt: application?.submittedAt ?? null,
  };
}

// ── Specialized qualifications ────────────────────────────────────────────────────────────────
// Qualification state is decided by the server (the review projection carries a per-family summary
// and a displayStatus per record, with expired approvals already labelled 'expired'). These helpers
// only choose labels and which admin actions to offer; the backend re-checks everything under a lock.

export const QUALIFICATION_STATUS_LABELS = {
  not_started: "Not submitted",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export const QUALIFICATION_BADGE_CLASSES = {
  not_started: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

// Approval of these types must carry a future expiry date (mirrors the backend rule).
export const EXPIRY_REQUIRED_QUALIFICATIONS = ["tdg"];

// Druppr's own training: an admin may grant it without an uploaded document. Other types are only
// ever approved from a driver's submission, so no Approve is offered where no evidence exists.
export const GRANTABLE_QUALIFICATIONS = ["legal_process_service"];

export function qualificationRecordActions(record) {
  const status = record?.displayStatus;
  return {
    // Only a pending submission that actually carries a document can be approved.
    canApprove: status === "pending" && Boolean(record?.documentUrl),
    canReject: status === "pending",
    // A current approval can be revoked (it becomes Rejected with a reason).
    canRevoke: status === "approved",
  };
}

export function canGrantQualification(summary) {
  return (
    Boolean(summary) &&
    GRANTABLE_QUALIFICATIONS.includes(summary.type) &&
    ["not_started", "rejected", "expired"].includes(summary.status)
  );
}

// "YYYY-MM-DD" from a date input; `today` is the admin's local "YYYY-MM-DD".
export function approvalExpiryError(certType, expiresOn, today) {
  if (!expiresOn) {
    return EXPIRY_REQUIRED_QUALIFICATIONS.includes(certType)
      ? "An expiry date is required to approve this qualification."
      : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return "Enter the expiry date as YYYY-MM-DD.";
  if (expiresOn <= today) return "The expiry date must be in the future.";
  return null;
}

// Decision body for PATCH admin/certifications/:id/review. expectedStatus makes the server refuse a
// decision taken on a stale screen (another admin decided first).
export function qualificationDecisionBody(record, approved, { reason, expiresOn } = {}) {
  return {
    approved,
    expectedStatus: record?.status,
    ...(approved
      ? expiresOn
        ? { expiresAt: expiresOn }
        : {}
      : { rejectionReason: typeof reason === "string" ? reason.trim() : reason }),
  };
}

export function qualificationGrantBody(driverUserId, certType, expiresOn) {
  return { driverUserId, certType, ...(expiresOn ? { expiresAt: expiresOn } : {}) };
}

export function apiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join(", ") || fallback;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}
