import { useState } from "react";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { SuccessModal } from "../modals/success";
import { MdClose } from "react-icons/md";

export const UpdatePayoutStatus = ({ id, closeModal, refresh }) => {
  const [status, setStatus] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const { setGlobalLoading } = useGlobalContext();

  async function handleUpdateStatus(e) {
    e.preventDefault();
    setGlobalLoading(true);
    const url = `/payouts/${id}/status`;
    try {
      const { status: resStatus } = await customFetch.patch(url, { status });
      if (resStatus === 200) {
        setGlobalLoading(false);
        setUpdateSuccess(true);
        if (refresh) refresh();
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  return (
    <article className="modalBG">
      {updateSuccess ? (
        <SuccessModal
          closeModalFunction={setUpdateSuccess}
          message={"Payout status changed successfully"}
          closeParentModal={closeModal}
        />
      ) : (
        <div className="longModalContainer border-4 px-4">
          <div className="flex justify-between mb-4">
            <p className="text-lg font-semibold text-gray900">Update Payout Status</p>
            <button onClick={() => closeModal(false)}>
              <MdClose size={24} className="text-gray500" />
            </button>
          </div>
          <form onSubmit={handleUpdateStatus}>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border-gray300 text-gray900 bg-white inline-block w-full border rounded-lg py-2 pl-2 globalInputRingGreen"
            >
              <option value="" disabled>
                Set payout status
              </option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <div className="border-t border-gray200 mt-4">
              <button type="submit" className="smallModalButton">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
};
