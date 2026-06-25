import { useEffect, useState } from "react";
import { SuccessModal } from "./success";
import { useGlobalContext } from "../../utils/context";
import { ApiResponseMsg } from "../apiResponseMsg";
import { LoadingIcon } from "../loadingIcon";
import { MdClose } from "react-icons/md";
import customFetch from "../../utils/customFetch";

export const ChangePasswordModal = () => {
  const {
    dispatch,
    apiResponseMessage,
    apiResponseState,
    setChangePasswordModal,
  } = useGlobalContext();

  const [success, setSuccess] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const changePasswordFormFields = [
    {
      id: 0,
      name: "currentPassword",
      label: "Current Password",
      type: "text",
      placeHolder: "Enter current password",
    },
    {
      id: 1,
      name: "newPassword",
      label: "Enter new password",
      type: "text",
      placeHolder: "password must be more than 5 characters",
    },
    {
      id: 2,
      name: "confirmNewPassword",
      label: "Confirm new password",
      type: "text",
      placeHolder: "password must be more than 5 characters",
    },
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  }

  //submit
  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmNewPassword) {
      dispatch({
        type: "SET_ApiResponse_MSG",
        payload: "new password and confirm new password don't match",
      });
      return;
    }

    setChangePasswordLoading(true);

    dispatch({
      type: "DISABLE_ApiResponse_MSG",
    });

    const url = `auth/change-password`;
    try {
      const { status } = await customFetch.post(url, { ...formData });

      if (status === 201) {
        setChangePasswordLoading(false);
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
        });
        setSuccess(true);
      }
    } catch (error) {
      setChangePasswordLoading(false);
      console.log(error);

      const { status } = error?.response;

      if (status === 400 || status === 403 || status === 500) {
        dispatch({
          type: "SET_ApiResponse_MSG",
          payload: error.response.data.message,
        });
      }

      if (error.message.includes("Network Error")) {
        dispatch({
          type: "SET_ApiResponse_MSG",
          payload:
            "Network error occured, please check your internet connection",
        });
      }
    }
  }

  // clear response error on load
  useEffect(() => {
    dispatch({
      type: "DISABLE_ApiResponse_MSG",
    });
  }, []);

  console.log("chnage password");

  return (
    <section className=" modalBG">
      {success ? (
        <SuccessModal
          message={"password changed successfully"}
          closeModalFunction={setSuccess}
          closeParentModal={setChangePasswordModal}
        />
      ) : (
        <div className=" longModalContainer border-4 p-4">
          {/* header */}
          <div className=" flex gap-x-4 px-4 ">
            {/* header text */}
            <p className=" flex flex-col mr-auto ">
              <span className=" text-lg font-semibold text-gray900">
                Change Password
              </span>
              <span className=" text-sm ">Change your current password</span>
            </p>
            {/* cancel button */}
            <button
              onClick={() => {
                setChangePasswordModal(false);
              }}
            >
              <MdClose size={24} className=" text-gray500" />
            </button>
          </div>

          {/* form */}
          <form
            onSubmit={handleSubmit}
            className=" flex flex-col gap-y-2 mt-6 pt-4 border-t  border-gray200 "
          >
            <div className=" flex flex-col gap-3">
              {changePasswordFormFields.map(
                ({ id, label, name, placeHolder, type }) => (
                  <div key={id} className=" flex flex-col gap-3">
                    <label htmlFor="changePassword">{label}</label>
                    <input
                      type={type}
                      name={name}
                      placeholder={placeHolder}
                      value={formData[name]}
                      onChange={handleChange}
                      className={`border-gray300 text-gray900 inline-block w-full border rounded-lg py-1  globalInputRingGreen placeholder:text-xs p-2 `}
                      required
                    />
                  </div>
                )
              )}
            </div>
            {/* submit button */}
            <div className="  border-t  border-gray200 mt-4 ">
              <button type="submit" className=" smallModalButton ">
                {changePasswordLoading ? <LoadingIcon /> : <span>Submit</span>}
              </button>
            </div>
            {apiResponseState && (
              <ApiResponseMsg message={apiResponseMessage} />
            )}
          </form>
        </div>
      )}
    </section>
  );
};
