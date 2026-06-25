import { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { usePayoutsContext } from "../utils/payoutsContext";
import { getFormattedDateTime } from "../utils/dateTime";
import { UpdatePayoutStatus } from "../components/payouts/updatePayoutStatus";
import { PayoutDetails } from "../components/payouts/payoutDetails";

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

  const statusClass = (value) => {
    if (value === "pending") return "bg-yellow-200 text-yellow-700";
    if (value === "processing") return "bg-blue-200 text-blue-700";
    if (value === "completed") return "bg-green-200 text-green-700";
    return "bg-red-200 text-red-700";
  };

  const refresh = () => fetchPayouts(currentPage, 10, order, filterStatus);

  return (
    <section className="px-4 pt-5">
      {viewId && <PayoutDetails id={viewId} closeModal={setViewId} />}
      {updateId && (
        <UpdatePayoutStatus id={updateId} closeModal={setUpdateId} refresh={refresh} />
      )}
      <h1 className="font-semibold text-lg mb-4">Payouts</h1>
      <div className="flex flex-col md:flex-row gap-2 md:justify-between items-start md:items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSort}
            className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
          >
            Sort {order === "DESC" ? "Newest" : "Oldest"}
          </button>
        </div>
        <div className="text-xs pl-1">
          <div className="mt-3 flex flex-col gap-3">
            <label htmlFor="statusFilter" className="font-medium text-primaryGreen">
              Filter payouts by status:
            </label>
            <select
              id="statusFilter"
              value={filterStatus}
              onChange={handleStatusChange}
              className="border p-2 rounded border-primaryGreen"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse border text-center border-gray200 text-gray600 mt-3 text-xs md:text-sm">
          <thead className="bg-gray50 font-medium">
            <tr>
              <th className="border border-gray200 p-3">Payout ID</th>
              <th className="border border-gray200 p-3">Driver Name</th>
              <th className="border border-gray200 p-3">Driver Email</th>
              <th className="border border-gray200 p-3">Status</th>
              <th className="border border-gray200 p-3">Total Amount</th>
              <th className="border border-gray200 p-3">Created At</th>
              <th className="border border-gray200 p-3">Orders Count</th>
              <th className="border border-gray200 p-3">Action</th>
            </tr>
          </thead>
          {payouts.length < 1 ? (
            <tbody>
              <tr>
                <td>
                  <p className="p-2 w-full">No payouts available</p>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {payouts.map(({ id, driver, status, amount, createdAt, orders }) => (
                <tr key={id} className="globalTransition hover:bg-gray100 bg-white">
                  <td className="border border-gray200 p-3">{id}</td>
                  <td className="border border-gray200 p-3">
                    {driver?.firstName} {driver?.lastName}
                  </td>
                  <td className="border border-gray200 p-3">{driver?.email}</td>
                  <td className="border border-gray200 p-3">
                    <span className={`px-2 py-1 rounded ${statusClass(status)}`}>{status}</span>
                  </td>
                  <td className="border border-gray200 p-3">${amount}</td>
                  <td className="border border-gray200 p-3">
                    {getFormattedDateTime(createdAt)}
                  </td>
                  <td className="border border-gray200 p-3">{orders?.length}</td>
                  <td className="border border-gray200 p-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setViewId(id)}
                      className="px-3 py-1 border rounded-md hover:bg-blue-100 globalTransition text-xs"
                    >
                      View Details
                    </button>
                    {status !== "completed" && status !== "failed" && (
                      <button
                        onClick={() => setUpdateId(id)}
                        className="px-3 py-1 border rounded-md hover:bg-blue-100 globalTransition text-xs"
                      >
                        Update Status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
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
      </div>
    </section>
  );
};
