import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { getFormattedDateTime } from "../../utils/dateTime";

export const PayoutDetails = ({ id, closeModal }) => {
  const { setGlobalLoading } = useGlobalContext();
  const [payout, setPayout] = useState(null);

  async function fetchPayout() {
    setGlobalLoading(true);
    const url = `/payouts/${id}`;
    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);
      if (status === 200) {
        setGlobalLoading(false);
        setPayout(data);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    fetchPayout();
  }, []);

  if (!payout) return null;

  const { driver, status, amount, createdAt, orders = [] } = payout;

  const payoutInfo = driver?.driver?.payoutInfo || {};
  const {
    bankAccountNumber,
    transitNumber,
    financialInstitutionNumber,
    bankName,
    bankAddress,
  } = payoutInfo;

  const getStatusClass = (value) => {
    if (value === "pending") return "bg-yellow-200 text-yellow-700";
    if (value === "processing") return "bg-blue-200 text-blue-700";
    if (value === "completed") return "bg-green-200 text-green-700";
    return "bg-red-200 text-red-700";
  };

  return (
    <article className="modalBG">
      <div className="longModalContainer border-4 p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <p className="text-lg font-semibold text-gray900">Payout Details</p>
          <button onClick={() => closeModal(false)}>
            <MdClose size={24} className="text-gray500" />
          </button>
        </div>

        <div className="mb-6 shadow-md p-4 rounded-md border bg-gray50 text-sm md:text-base">
          <h2 className="text-lg font-semibold mb-2 text-gray800">Driver Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <p>
              <strong>Driver:</strong> {driver?.firstName} {driver?.lastName}
            </p>
            <p>
              <strong>Email:</strong> {driver?.email}
            </p>
            <p>
              <strong>Phone:</strong> {driver?.phoneNumber}
            </p>
            <p>
              <strong>Status:</strong>
              <span className={`ml-2 px-2 py-1 rounded ${getStatusClass(status)}`}>
                {status}
              </span>
            </p>
            <p>
              <strong>Amount:</strong> ${amount}
            </p>
            <p>
              <strong>Created At:</strong> {getFormattedDateTime(createdAt)}
            </p>
          </div>
        </div>

        {driver?.driver?.payoutInfo && (
          <div className="mb-6 shadow-md p-4 rounded-md border bg-gray50 text-sm md:text-base">
            <h2 className="text-lg font-semibold mb-2 text-gray800">Bank Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <p>
                <strong>Bank Name:</strong> {bankName || "-"}
              </p>
              <p>
                <strong>Account Number:</strong> {bankAccountNumber || "-"}
              </p>
              <p>
                <strong>Transit Number:</strong> {transitNumber || "-"}
              </p>
              <p>
                <strong>Institution Number:</strong> {financialInstitutionNumber || "-"}
              </p>
              <p className="md:col-span-2">
                <strong>Bank Address:</strong> {bankAddress || "-"}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-auto max-h-[300px]">
          <h2 className="text-lg font-semibold mb-2 text-gray800">Orders</h2>
          <table className="w-full border-collapse text-xs text-gray600 border border-gray200">
            <thead className="bg-gray50 font-medium">
              <tr>
                <th className="border border-gray200 p-2">Tracking Code</th>
                <th className="border border-gray200 p-2">Section</th>
                <th className="border border-gray200 p-2">Fee</th>
                <th className="border border-gray200 p-2">Delivery Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(
                ({ trackingCode, section, fee, status: orderStatus }, index) => (
                  <tr key={index} className="bg-white hover:bg-gray100">
                    <td className="border border-gray200 p-2">{trackingCode}</td>
                    <td className="border border-gray200 p-2">{section}</td>
                    <td className="border border-gray200 p-2">${fee}</td>
                    <td className="border border-gray200 p-2">{orderStatus}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
};
