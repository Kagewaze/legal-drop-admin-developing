/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
// One payout: who is owed, how much, what is on record about its payment (GET /payouts/:id/external-payments) and the
// orders it pays for. Read only.
import { ErrorState, LoadingRows } from "../moderation/ui";
import { cellClass, headCellClass, secondaryButton, tableWrapClass } from "../moderation/styles";
import { formatCad, toMinor } from "../../utils/payoutPayments";
import { PaymentEvidencePanel, PayoutModal, PayoutSummary } from "./payoutEvidence";
import { usePayoutRecord } from "./usePayoutRecord";

function OrdersTable({ orders }) {
  if (!orders.length) return <p className="text-sm text-gray600">No orders are linked to this payout.</p>;
  return (
    <div className={tableWrapClass}>
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Orders paid by this payout</caption>
        <thead className="bg-gray50">
          <tr>
            {["Tracking code", "Section", "Fee", "Delivery status"].map((heading) => (
              <th key={heading} scope="col" className={headCellClass}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray100">
          {orders.map(({ trackingCode, section, fee, status }, index) => (
            <tr key={trackingCode || index} className="bg-white">
              <td className={`${cellClass} font-medium text-gray900`}>{trackingCode}</td>
              <td className={cellClass}>{section}</td>
              <td className={cellClass}>{formatCad(toMinor(fee))}</td>
              <td className={cellClass}>{status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Props: id (payout), closeModal(). */
export const PayoutDetails = ({ id, closeModal }) => {
  const record = usePayoutRecord(id);
  const { payout, evidence } = record;
  const close = () => closeModal(null);
  const ready = record.status === "ready" || record.status === "refreshing";
  return (
    <PayoutModal
      title="Payout details"
      onClose={close}
      wide
      footer={
        <button type="button" className={secondaryButton} onClick={close}>
          Close
        </button>
      }
    >
      {record.status === "loading" ? <LoadingRows label="Loading payout…" rows={4} /> : null}
      {record.status === "error" ? <ErrorState error={record.error} onRetry={record.reload} /> : null}
      {ready ? (
        <>
          <PayoutSummary payout={payout} evidence={evidence} />
          <PaymentEvidencePanel payout={payout} evidence={evidence} />
          <p className="text-xs text-gray500">
            These records track transfers or manual settlement, not confirmed bank receipt. Raw bank details are not displayed here.
          </p>
          <section aria-labelledby="payout-orders-title" className="space-y-2">
            <h3 id="payout-orders-title" className="text-base font-semibold text-gray900">
              Orders
            </h3>
            <OrdersTable orders={payout?.orders ?? []} />
          </section>
        </>
      ) : null}
    </PayoutModal>
  );
};
