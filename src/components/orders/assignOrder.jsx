import { TbUserPlus } from "react-icons/tb";
import { MdClose } from "react-icons/md";
import { useState } from "react";
import { useOrdersContext } from "../../utils/ordersContext";
import { SuccessModal } from "../modals/success";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import {  SearchEntity } from "../searchEntity";

export const AssignOrder = ({ orderId }) => {
  const [formData, setFormData] = useState({
    orderId: orderId,
    driverId: "",
  });

  const { setShowAssignOrder } = useOrdersContext();
  const { setGlobalLoading } = useGlobalContext();
  const [assignSuccess, setAssignSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGlobalLoading(true);
    const url = "admin/assign-order";
    try {
      const { status } = await customFetch.post(url, formData);
      if (status === 201) {
        setGlobalLoading(false);
        setAssignSuccess(true);
        setFormData({ orderId: "", driverId: "" });
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  return (
    <section className="modalBG">
      {assignSuccess ? (
        <SuccessModal
          closeModalFunction={setShowAssignOrder}
          message={"Driver assigned successfully"}
          closeParentModal={setShowAssignOrder}
        />
      ) : (
        <div className=" longModalContainer border-4">
          {/* header */}
          <div className=" flex gap-x-4 px-4 ">
            <div className=" globalIconBG">
              <TbUserPlus size={24} className=" text-gray700" />
            </div>
            {/* header text */}
            <p className=" flex flex-col mr-auto ">
              <span className=" text-lg font-semibold text-gray900">
                Assign Order
              </span>
              <span className=" text-sm  text-gray600">
                assign order to a driver
              </span>
            </p>
            {/* cancel button */}
            <button onClick={() => setShowAssignOrder(false)}>
              <MdClose size={24} className=" text-gray500" />
            </button>
          </div>

          {/* form */}
          <div>
            <form
              onSubmit={handleSubmit}
              className=" flex flex-col gap-y-2 mt-6 pt-4 border-t  border-gray200 "
            >
              <div className=" px-4">
                <label className=" text-gray500 font-medium text-sm mb-1">
                  Driver ID*
                </label>
                <SearchEntity
                  setFormData={setFormData}
                  formData={formData}
                  routeTitle={"riders"}
                  placeholder={
                    "Search for driver by name, phone number or email..."
                  }
                />
              </div>

              {/* submit button */}
              <div className=" px-4 border-t  border-gray200 mt-4 ">
                <button type="submit" className=" smallModalButton ">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
