import { MdClose } from "react-icons/md";
import { useGlobalContext } from "../../utils/context";
import { useEffect, useState } from "react";
import { LoadingIcon } from "../loadingIcon";
import { baseUrl } from "../../utils/customFetch";
import axios from "axios";
import { ApiResponseMsg } from "../apiResponseMsg";
import { ResetPasswordModal } from "./resetPassword";

export const ForgotPasswordModal = () => {
  const {
    setForgotPasswordModal,
    dispatch,
    apiResponseMessage,
    apiResponseState,
    showResetPasswordModal,
    setResetPasswordModal,
  } = useGlobalContext();
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const [email, setEmail] = useState({
    userIdentifier: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setEmail({
      [name]: value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setForgotPasswordLoading(true);
    dispatch({
      type: "DISABLE_ApiResponse_MSG",
    });

    const url = `${baseUrl}otp/send/forgot-password`;

    try {
      const {
        status,
        data: { message },
      } = await axios.post(url, email);

      if (status === 201) {
        setResetPasswordModal(true);
        setForgotPasswordLoading(false);
        dispatch({
          type: "SET_ApiResponse_MSG",
          payload: message,
        });
      }
    } catch (error) {
      setForgotPasswordLoading(false);
      console.log(error);

      const { status } = error?.response;

      if (status === 400 || status === 500) {
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
      {showResetPasswordModal ? (
        <ResetPasswordModal email={email} />
      ) : (
        <div className=" longModalContainer border-4 p-4">
          {/* header */}
          <div className=" flex gap-x-4 px-4 ">
            {/* header text */}
            <p className=" flex flex-col mr-auto ">
              <span className=" text-lg font-semibold text-gray900">
                Forgot password
              </span>
              <span className=" text-sm  text-gray600">
                An OTP will be sent to your email
              </span>
            </p>
            {/* cancel button */}
            <button onClick={() => setForgotPasswordModal(false)}>
              <MdClose size={24} className=" text-gray500" />
            </button>
          </div>

          {/* form */}
          <form
            onSubmit={handleSubmit}
            className=" flex flex-col gap-y-2 mt-6 pt-4 border-t  border-gray200 "
          >
            <div className=" flex flex-col gap-3">
              <label htmlFor="forgotPassword">User Identifier*</label>
              <input
                type="text"
                name="userIdentifier"
                placeholder={"Enter email address"}
                value={email.userIdentifier}
                onChange={handleChange}
                className={`border-gray300 text-gray900 inline-block w-full border rounded-lg py-1  globalInputRingGreen placeholder:text-xs p-2 `}
                required
              />
            </div>
            {/* submit button */}
            <div className="  border-t  border-gray200 mt-4 ">
              <button type="submit" className=" smallModalButton ">
                {forgotPasswordLoading ? (
                  <LoadingIcon />
                ) : (
                  <span>Continue</span>
                )}
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
