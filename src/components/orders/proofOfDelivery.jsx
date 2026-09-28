/* eslint-disable react/prop-types -- this app declares no prop-types dependency and no component uses PropTypes */
import { useCallback, useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import customFetch from "../../utils/customFetch";
import { getFormattedDateTime } from "../../utils/dateTime";
import {
  STATUS_BADGE_CLASSES,
  evidenceLabel,
  mapsLink,
  proofMediaUrl,
  proofUrl,
  stageRows,
  stopNumberFor,
  timelineRows,
  usableMediaAccess,
} from "../../utils/proofOfDelivery";

// Resolve every status so the shared interceptor never toasts (e.g. a 404 from a backend without
// proof reads) and no rejected Axios error — which would carry a signed URL — is ever created.
const RESOLVE_ALL = { validateStatus: () => true };

/**
 * PROOF OF DELIVERY — operational section of the admin order detail (Wave 2B.4).
 *
 * Verification stage, method, policy version, representative, role, timestamps, exact GPS, fallback
 * reason, driver and evidence for every stage, then the full append-only audit sequence. Evidence
 * images are fetched as short-lived signed URLs on demand and held only while the viewer is open.
 */
export const ProofOfDelivery = ({ orderId }) => {
  const [state, setState] = useState({ loading: true, proof: null, failed: false });
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, proof: null, failed: false });
    try {
      const { status, data } = await customFetch.get(proofUrl(orderId), RESOLVE_ALL);
      if (status === 200) setState({ loading: false, proof: data?.data ?? null, failed: false });
      else if (status === 404) setState({ loading: false, proof: null, failed: false });
      else setState({ loading: false, proof: null, failed: true });
    } catch {
      setState({ loading: false, proof: null, failed: true });
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) load();
  }, [orderId, load]);

  if (!orderId) return null;

  const { loading, proof, failed } = state;
  const stopNumber = stopNumberFor(proof);
  const stages = proof
    ? [
        ...(proof.pickup ? [{ key: "pickup", title: "Pickup", stage: proof.pickup }] : []),
        ...proof.deliveries.map((stage, i) => ({
          key: stage.deliveryPointId ?? `stop-${i}`,
          title: proof.deliveries.length > 1 ? `Delivery · stop ${i + 1}` : "Delivery",
          stage,
        })),
      ]
    : [];
  const timeline = proof ? timelineRows(proof.events, { formatDate: getFormattedDateTime, stopNumber }) : [];

  return (
    <div className="mb-10 shadow-md p-2 py-4 rounded-md border bg-gray50">
      <h2 className="text-lg font-semibold text-black mb-4">Proof of Delivery</h2>

      {loading && <p className="pl-4 text-sm">Loading proof of delivery…</p>}
      {!loading && failed && (
        <p className="pl-4 text-sm">
          Proof of delivery is temporarily unavailable.{" "}
          <button onClick={load} className="text-primaryGreen font-semibold">
            Try again
          </button>
        </p>
      )}
      {!loading && !failed && !proof && <p className="pl-4 text-sm">No proof-of-delivery record for this order.</p>}

      {proof && (
        <>
          <div className="pl-4 grid md:grid-cols-2 gap-6 text-sm md:text-base mb-6">
            <p>
              <strong>Verification:</strong>{" "}
              {proof.verificationVersion ? `Delivery verification (${proof.verificationVersion})` : "Legacy booking codes"}
            </p>
            <p>
              <strong>Service class:</strong> {proof.serviceClass}
            </p>
          </div>

          {stages.map(({ key, title, stage }) => (
            <div key={key} className="border-b mb-6 p-4 text-sm md:text-base">
              <p className="font-bold text-primaryGreen mb-3 flex items-center gap-2">
                {title}
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASSES[stage.status] ?? "bg-gray-100"}`}>
                  {stage.statusLabel ?? stage.status}
                </span>
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {stageRows(stage, { formatDate: getFormattedDateTime }).map(([label, value]) => (
                  <p key={label}>
                    <strong>{label}:</strong> {value}
                    {label === "GPS" && mapsLink(stage.location) ? (
                      <a href={mapsLink(stage.location)} target="_blank" rel="noreferrer" className="ml-2 text-primaryGreen font-semibold">
                        map
                      </a>
                    ) : null}
                  </p>
                ))}
              </div>
              {stage.evidence.length > 0 && (
                <p className="mt-3">
                  <strong>Evidence:</strong>{" "}
                  {stage.evidence.map((item) => (
                    <button
                      key={item.mediaId}
                      onClick={() => setViewing(item)}
                      className="text-primaryGreen font-semibold mr-4"
                    >
                      view {evidenceLabel(item.type).toLowerCase()}
                    </button>
                  ))}
                </p>
              )}
            </div>
          ))}

          <h3 className="font-semibold text-black mb-2 pl-4">Verification audit sequence</h3>
          {timeline.length === 0 ? (
            <p className="pl-4 text-sm">No verification events (legacy order or not yet verified).</p>
          ) : (
            <div className="overflow-x-auto pl-4">
              <table className="min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">When</th>
                    <th className="p-2">Stage</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Outcome</th>
                    <th className="p-2">Fallback reason</th>
                    <th className="p-2">Representative</th>
                    <th className="p-2">GPS</th>
                    <th className="p-2">Driver</th>
                    <th className="p-2">Evidence</th>
                    <th className="p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row) => (
                    <tr key={row.id} className={`border-b ${row.superseded ? "text-gray-400 line-through" : ""}`}>
                      <td className="p-2 whitespace-nowrap">{row.when}</td>
                      <td className="p-2">{row.stage}</td>
                      <td className="p-2">{row.method}</td>
                      <td className="p-2">{row.outcome}</td>
                      <td className="p-2">{row.reason ?? "-"}</td>
                      <td className="p-2">{row.representative ?? "-"}</td>
                      <td className="p-2">{row.gps ?? "-"}</td>
                      <td className="p-2">{row.driver ?? "-"}</td>
                      <td className="p-2 no-underline">
                        {row.evidence.length === 0
                          ? "-"
                          : row.evidence.map((item) => (
                              <button
                                key={item.mediaId}
                                onClick={() => setViewing(item)}
                                className="text-primaryGreen font-semibold mr-2"
                              >
                                {evidenceLabel(item.type).toLowerCase()}
                              </button>
                            ))}
                      </td>
                      <td className="p-2">{row.notes.join("; ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {viewing && <EvidenceViewer orderId={orderId} evidence={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

const EvidenceViewer = ({ orderId, evidence, onClose }) => {
  const [access, setAccess] = useState(null);
  const [status, setStatus] = useState("loading");

  const fetchAccess = useCallback(async () => {
    setStatus("loading");
    try {
      const { status: http, data } = await customFetch.get(proofMediaUrl(orderId, evidence.mediaId), RESOLVE_ALL);
      const usable = http === 200 ? usableMediaAccess(data?.data) : null;
      setAccess(usable);
      setStatus(usable ? "ready" : "unavailable");
    } catch {
      setAccess(null);
      setStatus("unavailable");
    }
  }, [orderId, evidence.mediaId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  // Refresh shortly before the signed URL expires (it lives for minutes).
  useEffect(() => {
    if (!access) return undefined;
    const timer = setTimeout(fetchAccess, Math.max(0, Date.parse(access.expiresAt) - Date.now() - 20000));
    return () => clearTimeout(timer);
  }, [access, fetchAccess]);

  return (
    <article className="bg-black fixed z-30 inset-0 bg-opacity-50 backdrop-blur-sm px-4 pt-8">
      <button onClick={onClose} className="ml-auto block" aria-label="Close">
        <MdClose size={34} className="text-primaryYellow mb-8" />
      </button>
      <div className="border border-primaryYellow grid place-items-center gap-4 h-[80vh] py-4 overflow-auto bg-white">
        {status === "ready" && access ? (
          <img
            src={access.url}
            alt={evidenceLabel(evidence.type)}
            referrerPolicy="no-referrer"
            className="object-contain max-h-full"
            onError={() => setStatus("unavailable")}
          />
        ) : status === "unavailable" ? (
          <p className="text-sm">
            Evidence temporarily unavailable.{" "}
            <button onClick={fetchAccess} className="text-primaryGreen font-semibold">
              Try again
            </button>
          </p>
        ) : (
          <p className="text-sm">Loading evidence…</p>
        )}
      </div>
    </article>
  );
};
