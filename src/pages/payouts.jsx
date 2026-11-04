import { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { usePayoutsContext } from "../utils/payoutsContext";
import { getFormattedDateTime } from "../utils/dateTime";
import { driverName, formatCad, manualPaymentAvailability, statusChangeOptions, toMinor } from "../utils/payoutPayments";
import { UpdatePayoutStatus } from "../components/payouts/updatePayoutStatus";
import { PayoutDetails } from "../components/payouts/payoutDetails";
import { RecordManualPayment } from "../components/payouts/recordManualPayment";
import { PayoutStatusBadge } from "../components/payouts/payoutEvidence";
import { IdText } from "../components/moderation/ui";
import { cellClass, controlClass, headCellClass, secondaryButton, tableWrapClass } from "../components/moderation/styles";

const actionButton =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray700 transition hover:border-[#8a5cf6] hover:bg-[#f8f5ff] hover:text-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#ede7ff]";
const primaryActionButton =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[#6d3adf] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#dcd0ff]";
const HEADINGS = ["Payout", "Driver", "Status", "Amount", "Created", "Orders", "Actions"];

export const Payouts = () => {
  const {
    payouts,
    fetchPayouts,
    currentPage,
    setCurrentPage,
    pageCount,
  } = usePayoutsContext();

  const [filterStatus, setFilterStatus] = useState("");
  const [order, setOrder] = useState("DESC");
  const [viewId, setViewId] = useState(null);
  const [updateId, setUpdateId] = useState(null);
  const [recordId, setRecordId] = useState(null);

  useEffect(() => {
    fetchPayouts(currentPage, 10, order, filterStatus);
  }, [currentPage, order, filterStatus]);

  const handlePageClick = (event) => {
    setCurrentPage(event.selected + 1);
  };

  const handleStatusChange = (e) => {
    setFilterStatus(e.target.value);
  };

  const toggleSort = () => {
    setOrder(order === "DESC" ? "ASC" : "DESC");
  };

  const refresh = () => fetchPayouts(currentPage, 10, order, filterStatus);

  return (
    <section className="space-y-4 px-4 pt-5 pb-8">
      {viewId && <PayoutDetails id={viewId} closeModal={setViewId} />}
      {updateId && <UpdatePayoutStatus id={updateId} closeModal={setUpdateId} refresh={refresh} />}
      {recordId && <RecordManualPayment id={recordId} closeModal={setRecordId} refresh={refresh} />}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray900">Payouts</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray600">
            Driver payouts. A payout paid by hand is completed only with the evidence of that payment; completed is final.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" onClick={toggleSort} className={secondaryButton}>
            Sort: {order === "DESC" ? "Newest first" : "Oldest first"}
          </button>
          <div>
            <label htmlFor="statusFilter" className="block text-xs font-semibold text-gray600">
              Status
            </label>
            <select id="statusFilter" value={filterStatus} onChange={handleStatusChange} className={`${controlClass} mt-1 w-56`}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Transfer completed / manual settlement</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </header>
      <div className={tableWrapClass}>
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-gray50">
            <tr>
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className={headCellClass}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray100">
            {payouts.length < 1 ? (
              <tr>
                <td colSpan={HEADINGS.length} className="px-3 py-8 text-center text-sm text-gray600">
                  No payouts available
                </td>
              </tr>
            ) : (
              payouts.map((payout) => {
                const { id, driver, amount, createdAt, orders } = payout;
                const canRecord = manualPaymentAvailability(payout).available;
                const canUpdate = statusChangeOptions(payout).length > 0;
                return (
                  <tr key={id} className="bg-white transition hover:bg-gray50">
                    <td className={cellClass}>
                      <IdText id={id} label="payout" />
                    </td>
                    <td className={cellClass}>
                      <p className="font-semibold text-gray900">{driverName(driver)}</p>
                      <p className="text-xs text-gray500">{driver?.email}</p>
                    </td>
                    <td className={cellClass}>
                      <PayoutStatusBadge payout={payout} />
                    </td>
                    <td className={`${cellClass} font-semibold text-gray900`}>{formatCad(toMinor(amount))}</td>
                    <td className={`${cellClass} whitespace-nowrap`}>{createdAt ? getFormattedDateTime(createdAt) : "—"}</td>
                    <td className={cellClass}>{orders?.length ?? 0}</td>
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setViewId(id)} className={actionButton}>
                          View details
                        </button>
                        {canUpdate && (
                          <button type="button" onClick={() => setUpdateId(id)} className={actionButton}>
                            Update status
                          </button>
                        )}
                        {canRecord && (
                          <button type="button" onClick={() => setRecordId(id)} className={primaryActionButton}>
                            Record payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ReactPaginate
        breakLabel="..."
        nextLabel="next >"
        onPageChange={handlePageClick}
        pageRangeDisplayed={5}
        pageCount={pageCount}
        previousLabel="< previous"
        renderOnZeroPageCount={null}
        containerClassName="pagination"
        pageLinkClassName="page-num"
        previousLinkClassName="page-num"
        nextLinkClassName="page-num"
        activeLinkClassName="active"
      />
    </section>
  );
};
