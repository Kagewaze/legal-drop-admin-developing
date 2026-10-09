import React, { useState } from "react";
import customFetch from "../utils/customFetch";
import { useGlobalContext } from "../utils/context";
import { SuccessModal } from "./modals/success";
import { MdClose } from "react-icons/md";
export const UpdateStatus = ({
  routeTitle,
  id,
  closeUpdateModal,
  seeChangesFunction,
}) => {
  const [formData, setFormData] = useState({
    id: id,
    status: "",
  });

  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [refusal, setRefusal] = useState("");

  const { setGlobalLoading } = useGlobalContext();

  // Define options for both user and driver based on routeTitle
  const userOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Blocked", value: "blocked" },
  ];

  const driverOptions = [
    { label: "Not Activated", value: "false" },
    { label: "Activated", value: "true" },
  ];

  // Select options based on routeTitle (either "user" or "driver")
  const options = routeTitle === "user" ? userOptions : driverOptions;

  const handleChange = (e) => {
    const { value } = e.target;
    setFormData({
      ...formData,
      status: value,
    });
  };

  async function handleUpdateStatus(e) {
    e.preventDefault();
    setRefusal("");
    setGlobalLoading(true);

    let formPayload;

    if (routeTitle === "user") {
      formPayload = {
        userId: formData.id,
        status: formData.status,
      };
    } else if (routeTitle === "driver") {
      formPayload = {
        driverUserId: formData.id,
        activated: formData.status == "true" ? true : false,
      };
    }

    const url = `admin/${routeTitle}-status`;
    try {
      const { status } = await customFetch.patch(url, formPayload);

      if (status === 200) {
        setGlobalLoading(false);
        setUpdateSuccess(true);
        seeChangesFunction();
      }
    } catch (error) {
      setGlobalLoading(false);
      // The shared client announces 400, 404 and 409 and is silent on 403. A refusal here is the
      // backend protecting an account (an administrator cannot be blocked or deactivated) or the
      // signed-in account no longer being an administrator: say so instead of doing nothing.
      if (error?.response?.status === 403) {
        setRefusal(
          error.response.data?.message ||
            "This change was refused. You may not have permission to make it."
        );
      }
    }
  }

  return (
    <article className="modalBG">
      {updateSuccess ? (
        <SuccessModal
          closeModalFunction={setUpdateSuccess}
          message={`${routeTitle} status changed successfully`}
          closeParentModal={closeUpdateModal}
        />
      ) : (
        <div className="longModalContainer border-4 px-4  ">
          {/* header */}
          <div className=" flex justify-between mb-4 ">
            <p className=" text-lg font-semibold text-gray900 ">
              <span className=" ">Update {routeTitle} status</span>
            </p>
            {/* cancel button */}
            <button onClick={() => closeUpdateModal(false)}>
              <MdClose size={24} className=" text-gray500" />
            </button>
          </div>

          <form onSubmit={handleUpdateStatus}>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="border-gray300 text-gray900 bg-white inline-block w-full border rounded-lg py-2 pl-2 globalInputRingGreen"
            >
              <option value="" disabled>
                {routeTitle === "user"
                  ? "Set user status"
                  : "Set driver status"}
              </option>
              {options.map(({value,label}) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {refusal ? (
              <p
                role="alert"
                className=" mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800"
              >
                {refusal}
              </p>
            ) : null}

            {/* Submit button */}
            <div className=" border-t border-gray200 mt-4">
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
