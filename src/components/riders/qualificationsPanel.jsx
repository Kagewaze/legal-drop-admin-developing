/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented at QualificationsPanel. */
import { useState } from "react";
import customFetch from "../../utils/customFetch";
import { getFormattedDateTime } from "../../utils/dateTime";
import {
  QUALIFICATION_BADGE_CLASSES,
  QUALIFICATION_STATUS_LABELS,
  REJECTION_REASON_MAX_LENGTH,
  apiErrorMessage,
  approvalExpiryError,
  canGrantQualification,
  qualificationDecisionBody,
  qualificationGrantBody,
  qualificationRecordActions,
  rejectionReasonError,
} from "../../utils/driverReview";

const formatDate = (value) => (value ? getFormattedDateTime(value) : "-");

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const Badge = ({ status }) => (
  <span className={`px-2 py-1 rounded text-xs ${QUALIFICATION_BADGE_CLASSES[status] || ""}`}>
    {QUALIFICATION_STATUS_LABELS[status] || status}
  </span>
);

// Specialized Qualifications on the Driver Review page. Every value shown comes from the server's
// review projection; after any mutation — success or failure — the parent re-fetches, so a stale or
// optimistic status is never displayed. Qualification decisions never change the driver account.
export const QualificationsPanel = ({
  driverUserId,
  qualifications,
  certifications,
  vehicle,
  onViewDocument,
  onChanged,
}) => {
  // { key: record id or qualification type, mode: "approve" | "reject" | "revoke" | "grant" }
  const [active, setActive] = useState(null);
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = (key, mode) => {
    setActive({ key, mode });
    setReason("");
    setExpiresOn("");
    setError("");
  };

  async function run(request) {
    setSubmitting(true);
    setError("");
    try {
      await request();
      setActive(null);
    } catch (e) {
      setError(apiErrorMessage(e, "The decision was not saved. Please try again."));
    } finally {
      setSubmitting(false);
      await onChanged();
    }
  }

  const submitDecision = (record, approved) => {
    const invalid = approved
      ? approvalExpiryError(record.certType, expiresOn, todayLocal())
      : rejectionReasonError(reason);
    if (invalid) {
      setError(invalid);
      return;
    }
    run(() =>
      customFetch.patch(
        `admin/certifications/${record.id}/review`,
        qualificationDecisionBody(record, approved, { reason, expiresOn })
      )
    );
  };

  const submitGrant = (summary) => {
    const invalid = approvalExpiryError(summary.type, expiresOn, todayLocal());
    if (invalid) {
      setError(invalid);
      return;
    }
    run(() => customFetch.post("admin/certifications", qualificationGrantBody(driverUserId, summary.type, expiresOn)));
  };

  const expiryInput = (required) => (
    <label className="block text-sm">
      Expiry date {required ? "(required)" : "(optional)"}
      <input
        type="date"
        value={expiresOn}
        min={todayLocal()}
        onChange={(e) => setExpiresOn(e.target.value)}
        className="block border rounded-md p-1 mt-1"
      />
    </label>
  );

  const reasonInput = () => (
    <label className="block text-sm">
      Reason (shown to the driver — no document numbers or other sensitive details)
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REJECTION_REASON_MAX_LENGTH}
        rows={2}
        className="block w-full border rounded-md p-2 mt-1"
      />
    </label>
  );

  const actionForm = (onConfirm, confirmLabel, body) => (
    <div className="mt-2 p-2 border rounded-md bg-gray50 space-y-2">
      {body}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="px-3 py-1 rounded-md bg-primaryGreen text-white text-xs disabled:opacity-40"
        >
          {submitting ? "Saving…" : confirmLabel}
        </button>
        <button onClick={() => setActive(null)} disabled={submitting} className="px-3 py-1 rounded-md border text-xs">
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="md:col-span-2 space-y-3">
      <h3 className="font-semibold">Specialized Qualifications</h3>
      <p className="text-xs text-gray-600">
        Qualifications unlock specialized jobs for an approved driver. Approving or revoking one never
        approves or deactivates the driver account.
      </p>

      {qualifications.map((summary) => {
        const records = certifications.filter((cert) => cert.certType === summary.type);
        const expiryRequired = summary.type === "tdg";
        return (
          <div key={summary.type} className="border rounded-md p-3 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{summary.label}</strong>
              <div className="flex items-center gap-2">
                {summary.status === "approved" && (
                  <span className="text-xs text-gray-600">
                    {summary.validUntil ? `Valid until ${formatDate(summary.validUntil)}` : "No expiry"}
                  </span>
                )}
                <Badge status={summary.status} />
              </div>
            </div>
            {summary.status === "rejected" && summary.rejectionReason && (
              <p className="text-sm mt-1">
                <strong>Reason:</strong> {summary.rejectionReason}
              </p>
            )}

            {/* Tow work needs BOTH this qualification and a tow-capable registered vehicle, and the
                two are verified separately: approving Tow Operator says nothing about the vehicle.
                Shown here so an admin is not left guessing why a qualified driver still cannot take
                tow jobs — the registered vehicle is the other half. */}
            {summary.type === "tow_operator" && (
              <p className="text-sm mt-1">
                <strong>Registered vehicle:</strong> {vehicle?.type || "Not set"}{" "}
                <span className="text-xs text-gray-600">
                  — verified separately from this qualification; a tow job also requires the vehicle
                  the job asks for.
                </span>
              </p>
            )}

            {canGrantQualification(summary) && (
              <div className="mt-2">
                <button onClick={() => open(summary.type, "grant")} className="px-3 py-1 rounded-md border text-xs">
                  Grant (training completed)
                </button>
                {active?.key === summary.type &&
                  active.mode === "grant" &&
                  actionForm(() => submitGrant(summary), "Confirm grant", expiryInput(expiryRequired))}
              </div>
            )}

            {records.length === 0 ? (
              <p className="text-sm text-gray-600 mt-2">Not submitted</p>
            ) : (
              <div className="overflow-auto mt-2">
                <table className="w-full border-collapse border text-xs md:text-sm">
                  <thead className="bg-gray50">
                    <tr>
                      <th className="border p-2">Status</th>
                      <th className="border p-2">Submitted</th>
                      <th className="border p-2">Issued</th>
                      <th className="border p-2">Expires</th>
                      <th className="border p-2">Document</th>
                      <th className="border p-2">Rejection reason</th>
                      <th className="border p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const { canApprove, canReject, canRevoke } = qualificationRecordActions(record);
                      const isActive = active?.key === record.id;
                      return (
                        <tr key={record.id} className="align-top">
                          <td className="border p-2">
                            <Badge status={record.displayStatus} />
                          </td>
                          <td className="border p-2">{formatDate(record.submittedAt)}</td>
                          <td className="border p-2">{formatDate(record.issuedAt)}</td>
                          <td className="border p-2">{record.expiresAt ? formatDate(record.expiresAt) : "Never"}</td>
                          <td className="border p-2">
                            {record.documentUrl ? (
                              <button onClick={() => onViewDocument(record.documentUrl)} className="text-primaryGreen font-semibold">
                                View
                              </button>
                            ) : record.source === "admin_grant" ? (
                              "Granted"
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="border p-2">{record.displayStatus === "rejected" ? record.rejectionReason : "-"}</td>
                          <td className="border p-2 space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {canApprove && (
                                <button onClick={() => open(record.id, "approve")} className="px-2 py-1 rounded border text-xs">
                                  Approve
                                </button>
                              )}
                              {canReject && (
                                <button onClick={() => open(record.id, "reject")} className="px-2 py-1 rounded border border-red-600 text-red-700 text-xs">
                                  Reject
                                </button>
                              )}
                              {canRevoke && (
                                <button onClick={() => open(record.id, "revoke")} className="px-2 py-1 rounded border border-red-600 text-red-700 text-xs">
                                  Revoke
                                </button>
                              )}
                            </div>
                            {isActive &&
                              active.mode === "approve" &&
                              actionForm(() => submitDecision(record, true), "Confirm approval", expiryInput(expiryRequired))}
                            {isActive &&
                              (active.mode === "reject" || active.mode === "revoke") &&
                              actionForm(
                                () => submitDecision(record, false),
                                active.mode === "revoke" ? "Confirm revocation" : "Confirm rejection",
                                reasonInput()
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Props: driverUserId (string), qualifications (review.qualifications summaries), certifications
// (review.certifications history rows), onViewDocument(url), onChanged() — re-fetches the review.
