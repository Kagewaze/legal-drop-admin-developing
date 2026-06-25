import { useEffect, useState } from "react";
import { useOrdersContext } from "../utils/ordersContext";
import { useNavigate } from "react-router-dom";
import ReactPaginate from "react-paginate";
import { SearchEntity } from "../components/searchEntity";
import { useGlobalContext } from "../utils/context";

export const Orders = ({ fetchId, riderKey }) => {
  const {
    orders,
    fetchOrders,
    currentPage,
    setCurrentPage,
    pageCount,
    setOrders,
  } = useOrdersContext();
  const { setSearchTerm } = useGlobalContext();

  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetchOrders(currentPage, undefined, filterStatus, fetchId, riderKey);
  }, [currentPage, filterStatus]);

  // Handle page click
  const handlePageClick = (event) => {
    const newPage = event.selected + 1;
    setCurrentPage(newPage);
  };

  // Handle status change
  function handleStatusChange(event) {
    setFilterStatus(event.target.value);
  }

  return (
    <section className=" px-4 pt-5">
      <h1 className=" font-semibold text-lg mb-4">Orders</h1>
      <div className=" flex flex-col  md:flex-row items-start md:items-center justify-between">
        <div className="searchEntityContainer flex gap-4  items-center">
          {/* search orders */}
          <div>
            <SearchEntity
              routeTitle={"orders"}
              placeholder={"Search order by tracking code"}
              pageLayout={true}
              updateDataFunction={setOrders}
            />
          </div>
          {/* clear search button */}
          <button
            onClick={() => {
              setSearchTerm("");
              fetchOrders(
                currentPage,
                undefined,
                filterStatus,
                fetchId,
                riderKey
              );
            }}
            className=" border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
          >
            Clear search
          </button>
        </div>
        {/* filter */}
        <div className=" text-xs pl-1">
          <div className="mt-3 flex flex-col gap-3">
            <label
              htmlFor="statusFilter"
              className=" font-medium text-primaryGreen"
            >
              Filter orders by status:
            </label>
            <select
              id="statusFilter"
              value={filterStatus}
              onChange={handleStatusChange}
              className="border p-2 rounded border-primaryGreen"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="ongoing">Ongoing</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
      <div className=" overflow-auto">
        <table className="w-full border-collapse border text-center border-gray200 text-gray600 mt-3 text-xs md:text-sm">
          <thead className="bg-gray50 font-medium ">
            <tr>
              <th className="border border-gray200 p-3">Tracking Code</th>
              <th className="border border-gray200 p-3">Sender Name</th>
              <th className="border border-gray200 p-3">Sender Address</th>
              <th className="border border-gray200 p-3">Status</th>
              <th className="border border-gray200 p-3">Payment Method</th>
              <th className="border border-gray200 p-3">Fee</th>
              <th className="border border-gray200 p-3">Created At</th>
              <th className="border border-gray200 p-3">Action</th>
            </tr>
          </thead>
          {orders.length < 1 ? (
            <tbody>
              <tr>
                <td>
                  <p className=" p-2 w-full ">No available order yet</p>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {orders.map(
                ({
                  id,
                  trackingCode,
                  senderName,
                  senderAddress,
                  status,
                  paymentMethod,
                  fee,
                  createdAt,
                }) => (
                  <tr
                    key={id}
                    className=" globalTransition hover:bg-gray100 bg-white "
                  >
                    <td className="border border-gray200 p-3">
                      {trackingCode}
                    </td>
                    <td className="border border-gray200 p-3">{senderName}</td>
                    <td className="border border-gray200 p-3 min-w-[200px]">
                      {senderAddress}
                    </td>
                    <td className="border border-gray200 p-3">{status}</td>
                    <td className="border border-gray200 p-3">
                      {paymentMethod}
                    </td>
                    <td className="border border-gray200 p-3">${fee}</td>
                    <td className="border border-gray200 p-3">
                      {new Date(createdAt).toLocaleDateString()}
                    </td>
                    {/* Action Buttons */}
                    <td className="border p-3  border-gray200  ">
                      <button
                        className="px-3 py-1 mr-2  border p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
                        onClick={() => navigate(fetchId ? `/orders/${id}` : id)}
                      >
                        View order
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          )}
        </table>

        {/* Pagination */}
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
