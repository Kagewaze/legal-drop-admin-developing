import { useEffect, useState } from "react";
import { getFormattedDateTime } from "../../utils/dateTime";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { useParams } from "react-router-dom";
import { EditModal } from "../editFormModal";
import { Orders } from "../../pages/orders";
import { ImageModal } from "../imageModal";
import {
  REVIEW_BADGE_CLASSES,
  REJECTION_REASON_MAX_LENGTH,
  REQUIREMENT_LABELS,
  REVIEW_STATUS_LABELS,
  apiErrorMessage,
  rejectionReasonError,
  reviewActions,
  reviewDecisionBody,
} from "../../utils/driverReview";

const formatDate = (value) => (value ? getFormattedDateTime(value) : "-");

export const SingleRider = () => {
  const { setGlobalLoading } = useGlobalContext();
  const { singleRiderId } = useParams();
  const [showRiderEditModal, setRiderEditModal] = useState(false);
  const [imageData, setShowImageData] = useState("");
  const [showImage, setShowImage] = useState(false);

  const [rider, setRider] = useState({
    address: "",
    dob: "",
    email: "",
    emailVerified: false,
    firstName: "",
    id: "",
    lastName: "",
    location: "",
    phoneNumber: "",
    photoUrl: "",
    referralCode: "",
    role: "",
    status: "",
    driver: {},
  });

  // The review projection is the ONLY source for the review panel and its actions. It is replaced
  // wholesale from server responses — never patched locally — so a stale or optimistic status can
  // never be shown.
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const {
    address = "",
    dob = "",
    firstName = "",
    lastName = "",
    driver,
    email = "",
    emailVerified = false,
    id = "",
    location = "",
    phoneNumber = "",
    photoUrl = "",
    role = "",
  } = rider;

  const {
    acceptanceRate = 0,
    createdAt: driverCreatedAt = "",
    overAllRating = "",
    readyToRide = false,
  } = driver || {};

  async function fetchSingleRider() {
    setGlobalLoading(true);
    const url = `admin/riders?id=${singleRiderId}`;
    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setRider(data[0] || rider);
      }
    } catch (error) {
      console.error("Error fetching rider:", error);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function fetchReview() {
    try {
      const {
        data: { data },
      } = await customFetch(`admin/drivers/${singleRiderId}/review`);
      setReview(data);
      setReviewError("");
    } catch (error) {
      setReview(null);
      setReviewError(apiErrorMessage(error, "Could not load this driver's application."));
    }
  }

  async function decide(approved) {
    if (!review || submitting) return;
    if (!approved) {
      const invalid = rejectionReasonError(reason);
      if (invalid) {
        setActionError(invalid);
        return;
      }
    }

    setSubmitting(true);
    setActionError("");
    try {
      const {
        data: { data },
      } = await customFetch.patch(
        `admin/drivers/${singleRiderId}/approve`,
        reviewDecisionBody(review.application, approved, reason)
      );
      setReview(data.review);
      setRejecting(false);
      setReason("");
      await fetchSingleRider();
    } catch (error) {
      setActionError(apiErrorMessage(error, "The decision was not saved. Please try again."));
      // A 409 usually means the application moved underneath this screen; show what is committed now.
      await fetchReview();
    } finally {
      setSubmitting(false);
    }
  }

  function handleClickImage(images) {
    setShowImage(true);
    setShowImageData(images);
  }

  useEffect(() => {
    fetchSingleRider();
    fetchReview();
  }, []);

  const application = review?.application;
  const status = application?.status;
  const { canApprove, canReject } = reviewActions(application);
  const documents = review?.documents || {};
  const licenceImages = [documents.licenseFrontUrl, documents.licenseBackUrl].filter(Boolean);

  return (
    <>
      {showImage && (
        <ImageModal data={imageData} closeImgModal={setShowImage} />
      )}
      <section className="px-4">
        {showRiderEditModal && (
          <EditModal
            closeEditModal={setRiderEditModal}
            userData={rider}
            routeTitle={"rider"}
            id={id}
            seeChangesFunction={fetchSingleRider}
          />
        )}
        <div className="flex justify-between items-center">
          <h1 className="font-semibold text-lg mb-4">Driver Details</h1>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <button
              onClick={() => setRiderEditModal(true)}
              className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Application review */}
        <div className="mb-6 shadow-md p-2 py-4 rounded-md border bg-gray50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-2">
            <h2 className="text-xl font-semibold text-black">Driver application</h2>
            {status && (
              <span className={`px-3 py-1 rounded text-sm ${REVIEW_BADGE_CLASSES[status]}`}>
                {REVIEW_STATUS_LABELS[status]}
              </span>
            )}
          </div>

          {reviewError && (
            <p role="alert" className="px-4 mb-3 text-sm text-red-700">
              {reviewError}{" "}
              <button onClick={fetchReview} className="underline">
                Retry
              </button>
            </p>
          )}

          {review && (
            <div className="px-4 grid md:grid-cols-2 gap-6 text-sm md:text-base">
              <div className="space-y-2">
                <h3 className="font-semibold">Review record</h3>
                <p>
                  <strong>Submitted:</strong> {formatDate(application.submittedAt)}
                </p>
                <p>
                  <strong>Last decision:</strong> {formatDate(application.reviewedAt)}
                </p>
                {status === "rejected" && (
                  <p>
                    <strong>Rejection reason:</strong> {application.rejectionReason}
                  </p>
                )}
                {application.missingRequirements.length > 0 && (
                  <div>
                    <strong>Missing before it can be approved:</strong>
                    <ul className="list-disc ml-6">
                      {application.missingRequirements.map((key) => (
                        <li key={key}>{REQUIREMENT_LABELS[key] || key}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Vehicle</h3>
                <p>
                  <strong>Type:</strong> {review.vehicle?.type || "-"}
                </p>
                <p>
                  <strong>Make / model / year:</strong>{" "}
                  {[review.vehicle?.make, review.vehicle?.model, review.vehicle?.year]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </p>
                <p>
                  <strong>Registration no:</strong> {review.vehicle?.registrationNo || "-"}
                </p>
                <p>
                  <strong>Accepts pets:</strong> {review.vehicle?.petAccepted ? "Yes" : "No"}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Identity documents</h3>
                <p>
                  <strong>Driver&apos;s licence:</strong>{" "}
                  {licenceImages.length ? (
                    <button
                      onClick={() => handleClickImage(licenceImages)}
                      className="text-primaryGreen font-semibold"
                    >
                      view ({licenceImages.length === 2 ? "front and back" : "one side only"})
                    </button>
                  ) : (
                    "Not uploaded"
                  )}
                </p>
                <p>
                  <strong>Insurance:</strong>{" "}
                  {documents.insuranceDocUrl ? (
                    <button
                      onClick={() => handleClickImage([documents.insuranceDocUrl])}
                      className="text-primaryGreen font-semibold"
                    >
                      view
                    </button>
                  ) : (
                    "Not uploaded"
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Profile and service area</h3>
                <p>
                  <strong>Riding experience:</strong> {review.profile?.ridingExperience ?? "-"}
                </p>
                <p>
                  <strong>Home address:</strong> {review.profile?.homeAddress || "-"}
                </p>
                <p>
                  <strong>Service area:</strong>{" "}
                  {[review.profile?.province, review.profile?.countryCode].filter(Boolean).join(", ") || "-"}
                </p>
                <p>
                  <strong>Cities:</strong> {review.profile?.serviceCities?.join(", ") || "-"}
                </p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <h3 className="font-semibold">Certifications</h3>
                {review.certifications.length === 0 ? (
                  <p>None submitted.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse border text-xs md:text-sm">
                      <thead className="bg-gray50">
                        <tr>
                          <th className="border p-2">Type</th>
                          <th className="border p-2">Status</th>
                          <th className="border p-2">Expires</th>
                          <th className="border p-2">Document</th>
                        </tr>
                      </thead>
                      <tbody>
                        {review.certifications.map((cert) => (
                          <tr key={cert.id} className="bg-white">
                            <td className="border p-2 uppercase">{cert.certType}</td>
                            <td className="border p-2">{cert.status}</td>
                            <td className="border p-2">{cert.expiresAt ? formatDate(cert.expiresAt) : "Never"}</td>
                            <td className="border p-2">
                              {cert.documentUrl ? (
                                <button
                                  onClick={() => handleClickImage([cert.documentUrl])}
                                  className="text-primaryGreen font-semibold"
                                >
                                  view
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 border-t pt-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => decide(true)}
                    disabled={!canApprove || submitting}
                    className="px-4 py-2 rounded-md bg-green-600 text-white text-sm disabled:opacity-40"
                  >
                    {submitting && !rejecting ? "Approving…" : "Approve driver"}
                  </button>
                  <button
                    onClick={() => {
                      setActionError("");
                      setRejecting((open) => !open);
                    }}
                    disabled={!canReject || submitting}
                    className="px-4 py-2 rounded-md border border-red-600 text-red-700 text-sm disabled:opacity-40"
                  >
                    {status === "approved" ? "Revoke approval" : "Reject application"}
                  </button>
                </div>

                {rejecting && canReject && (
                  <div className="space-y-2">
                    <label htmlFor="rejection-reason" className="block text-sm font-medium">
                      Reason (shown to the driver — do not include document numbers or other sensitive details)
                    </label>
                    <textarea
                      id="rejection-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={REJECTION_REASON_MAX_LENGTH}
                      rows={3}
                      className="w-full border rounded-md p-2 text-sm"
                    />
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        {reason.trim().length}/{REJECTION_REASON_MAX_LENGTH}
                      </span>
                      <button
                        onClick={() => decide(false)}
                        disabled={submitting}
                        className="px-4 py-2 rounded-md bg-red-600 text-white text-sm disabled:opacity-40"
                      >
                        {submitting ? "Saving…" : "Confirm rejection"}
                      </button>
                    </div>
                  </div>
                )}

                {actionError && (
                  <p role="alert" className="text-sm text-red-700">
                    {actionError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 shadow-md p-2 py-4 rounded-md border bg-gray50">
          <h2 className="text-xl font-semibold text-black mb-4">
            Driver Information
          </h2>

          <div className="pl-4 grid md:grid-cols-2 gap-6 place-content-between text-sm md:text-base">
            <p className="h-[100px] w-[100px] border rounded-full border-primaryGreen">
              <img
                src={photoUrl || ""}
                alt="driver image"
                className="w-full h-full object-cover rounded-full"
              />
            </p>
            <p>
              <strong>DOB:</strong> {dob || "-"}
            </p>
            <p>
              <strong>First Name:</strong> {firstName || "-"}
            </p>
            <p>
              <strong>Last Name:</strong> {lastName || "-"}
            </p>
            <p>
              <strong>Email:</strong> {email || "-"}
            </p>
            <p>
              <strong>Email Verified:</strong>{" "}
              {emailVerified ? "True" : "False"}
            </p>
            <p>
              <strong>Location:</strong> {location || "-"}
            </p>
            <p>
              <strong>Phone Number:</strong> {phoneNumber || "-"}
            </p>
            <p>
              <strong>Account status:</strong> {rider.status || "-"}
            </p>
            <p>
              <strong>Address:</strong> {address || "-"}
            </p>
            <p>
              <strong>Role:</strong> {role || "-"}
            </p>
            <p>
              <strong>Acceptance Rate:</strong> {acceptanceRate || "-"}
            </p>
            <p>
              <strong>Overall Rating:</strong> {overAllRating || "-"}
            </p>
            <p>
              <strong>Ready to ride:</strong> {readyToRide ? "Yes" : "No"}
            </p>
            <p>
              <strong>Date Registered:</strong>{" "}
              {driverCreatedAt ? getFormattedDateTime(driverCreatedAt) : "-"}
            </p>
          </div>
        </div>
        <Orders fetchId={singleRiderId} riderKey={true} />
      </section>
    </>
  );
};
