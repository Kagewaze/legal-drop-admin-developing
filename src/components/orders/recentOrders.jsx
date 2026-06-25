import { useEffect, useState } from "react";
import { FaCheckCircle, FaTruck, FaHourglassHalf } from "react-icons/fa";
import { useOrdersContext } from "../../utils/ordersContext";
import { getFormattedDateTime } from "../../utils/dateTime";
import { useNavigate } from "react-router-dom";

export const RecentOrders = () => {
  const { orders, fetchOrders } = useOrdersContext();

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders(undefined, undefined, "pending");
  }, []);

  return (
    <div className=" mt-8">
      <h2 className="md:text-xl font-semibold mb-4">Recent Orders</h2>
      <div className=" overflow-auto">
        <table className="w-full table-auto border-collapse border text-center text-xs md:text-sm border-gray200 text-gray600">
          <thead>
            <tr className=" bg-gray50 font-medium  ">
              <th className="border border-gray200 p-3">Tracking Code</th>
              <th className="border border-gray200 p-3">Sender Name</th>
              <th className="border border-gray200 p-3">Sender Address</th>
              <th className="border border-gray200 p-3">Fee</th>
              <th className="border border-gray200 p-3">Status</th>
              <th className="border border-gray200 p-3">Payment Method</th>
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
              {orders
                .slice(-5)
                .map(
                  ({
                    id,
                    trackingCode,
                    senderName,
                    senderAddress,
                    status,
                    fee,
                    paymentMethod,
                    createdAt,
                  }) => (
                    <tr
                      key={id}
                      className=" globalTransition  hover:bg-gray100 bg-white"
                    >
                      <td className="p-2">{trackingCode}</td>
                      <td className="p-2">{senderName}</td>
                      <td className="p-2 min-w-[200px]">{senderAddress}</td>
                      <td className="p-2">${fee}</td>
                      <td className="p-2 ">
                        <div className=" flex  items-center justify-center gap-x-2">
                          {status === "Delivered" ? (
                            <FaCheckCircle className="text-green-500" />
                          ) : status === "Pending" ? (
                            <FaHourglassHalf className="text-yellow-500" />
                          ) : (
                            <FaTruck className="text-blue-500" />
                          )}
                          {status}
                        </div>
                      </td>
                      <td className="p-2">{paymentMethod}</td>
                      <td className="p-2">{getFormattedDateTime(createdAt)}</td>
                      {/* Action Buttons */}
                      <td className="border p-3  border-gray200  ">
                        <button
                          className="px-3 py-1 mr-2  border p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
                          onClick={() => navigate(`/orders/${id}`)}
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
      </div>
    </div>
  );
};
