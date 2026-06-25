import { MdClose } from "react-icons/md";
import { useGlobalContext } from "../../utils/context";
import { useEffect, useState } from "react";
import { LoadingIcon } from "../loadingIcon";
import { baseUrl } from "../../utils/customFetch";
import axios from "axios";
import { ApiResponseMsg } from "../apiResponseMsg";
import { SuccessModal } from "./success";

export const ResetPasswordModal = ({ email }) => {
  const {
    dispatch,
    apiResponseMessage,
    apiResponseState,
    setResetPasswordModal,
  } = useGlobalContext();

  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    ...email,
    code: "",
    password: "",
    confirmPassword: "",
  });

  const resetPasswordFormFields = [
    {
      id: 0,
      name: "code",
      label: "OTP Code",
      type: "text",
      placeHolder: "Enter OTP",
    },
    {
      id: 1,
      name: "password",
      label: "Enter new password",
      type: "text",
      placeHolder: "password must be more than 5 characters",
    },
    {
      id: 2,
      name: "confirmPassword",
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

  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      dispatch({
        type: "SET_ApiResponse_MSG",
        payload: "password and confirm password don't match",
      });
      return;
    }

    setResetPasswordLoading(true);

    dispatch({
      type: "DISABLE_ApiResponse_MSG",
    });

    const url = `${baseUrl}otp/verify/forgot-password`;
    try {
      const { status } = await axios.post(url, {
        userIdentifier: formData.userIdentifier,
        code: formData.code,
        metadata: {
          password: formData.password,
        },
      });

      if (status === 201) {
        setResetPasswordLoading(false);
        setFormData({
          code: "",
          password: "",
          confirmPassword: "",
        });
        setSuccess(true);
      }
    } catch (error) {
      setResetPasswordLoading(false);
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

  return (
    <section className=" modalBG">
      {success ? (
        <SuccessModal
          message={"password reset successfull. You can proceed to login"}
          closeModalFunction={setSuccess}
          closeParentModal={setResetPasswordModal}
        />
      ) : (
        <div className=" longModalContainer border-4 p-4">
          {/* header */}
          <div className=" flex gap-x-4 px-4 ">
            {/* header text */}
            <p className=" flex flex-col mr-auto ">
              <span className=" text-lg font-semibold text-gray900">
                Reset Password
              </span>
              <span className=" text-sm   text-green-500">
                Enter OTP Code sent to you
              </span>
            </p>
            {/* cancel button */}
            <button
              onClick={() => {
                setResetPasswordModal(false);
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
              {resetPasswordFormFields.map(
                ({ id, label, name, placeHolder, type }) => (
                  <div key={id} className=" flex flex-col gap-3">
                    <label htmlFor="resetPassword">{label}</label>
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
                {resetPasswordLoading ? <LoadingIcon /> : <span>Submit</span>}
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
