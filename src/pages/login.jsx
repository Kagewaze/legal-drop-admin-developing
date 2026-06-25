import { Link, Navigate } from "react-router-dom";
import { FiUser } from "react-icons/fi";
import { useState } from "react";
import { IoEyeOutline, IoEyeSharp } from "react-icons/io5";
import { useGlobalContext } from "../utils/context";
import { LoadingIcon } from "../components/loadingIcon";
import axios from "axios";
import { baseUrl } from "../utils/customFetch";
import { ForgotPasswordModal } from "../components/modals/forgotPassword";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    showPassword: false,
  });

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");

  const {
    dispatch,
    authStatus,
    showForgotPasswordModal,
    setForgotPasswordModal,
  } = useGlobalContext();

  // Handle input change
  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setFormData((prevData) => ({
      ...prevData,
      showPassword: !prevData.showPassword,
    }));
  };

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(false);
    setLoginErrorMsg("");

    const url = `${baseUrl}auth/login`;

    try {
      const { data, status } = await axios.post(url, {
        userIdentifier: formData.email,
        password: formData.password,
      });

      const { accessToken } = data.data;

      if (status === 201) {
        setLoginLoading(false);
        localStorage.setItem("CRMuser", "TESTUSER");
        dispatch({
          type: "LOGIN",
        });
        localStorage.setItem("CRMACCESSTOKEN", accessToken);
      }
    } catch (error) {
      console.log(error);
      setLoginLoading(false);
      setLoginError(true);
      if (error.message.includes("Network Error")) {
        setLoginErrorMsg("A network error occured, please try again");
      }
      if (error?.response.status == 400) {
        setLoginErrorMsg(error.response.data.message);
      }
    }
  }

  // always navigate to home if user is logged in
  if (authStatus) {
    return <Navigate to="/" />;
  }

  return (
    <>
      {showForgotPasswordModal && <ForgotPasswordModal />}
      <div className="bg-primaryGreen signinContainer">
        {/* body */}
        <div className="  h-screen ">
          {/* nav */}
          <div className=" flex  justify-between items-center ">
            {/* logo */}
            <div className=" font-mono text-xl">CRM</div>
            {/* title */}
            <div className=" flex  justify-between  gap-x-2">
              <p>Admin Portal</p>
            </div>
          </div>

          {/* body */}
          <section className=" flex flex-col justify-center items-center  relative    ">
            <div className=" mb-8 mt-[25%]  text-center relative z-10">
              {/* user icon */}
              <div className=" bg-white h-[56px] w-[56px] rounded-xl grid place-items-center mb-4 shadow-md mx-auto">
                <FiUser size={28} className=" text-gray700" />
              </div>
              <p className=" font-semibold text-2xl mb-2 ">Login</p>
              <p className=" text-sm ">Please enter your login details</p>
            </div>

            {/* login form */}
            <form
              onSubmit={handleLogin}
              className=" mb-[20%]  min-w-[360px] relative z-10"
            >
              {/* User ID */}
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block text-white font-medium text-sm  mb-2"
                >
                  User ID
                </label>
                <input
                  type="text"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white text-gray700 placeholder:text-sm  rounded-lg focus:ring-4 focus:outline-none focus:ring-gray300 globalTransition shadow-sm "
                  placeholder="Enter your email"
                  required
                />
              </div>

              {/* Password Input */}
              <div className="mb-2 relative">
                <label
                  htmlFor="password"
                  className="block text-white font-medium text-sm  mb-2"
                >
                  Password
                </label>
                <input
                  type={formData.showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white text-gray700 placeholder:text-sm  rounded-lg focus:ring-4 focus:outline-none focus:ring-gray300 globalTransition shadow-sm"
                  placeholder="Enter your password"
                  required
                />
                <div
                  className="absolute top-[50%] -translate-y-[10%] inset-y-0 right-3 flex items-center cursor-pointer"
                  onClick={togglePasswordVisibility}
                >
                  {formData.showPassword ? (
                    <IoEyeOutline size={16} className="text-gray500" />
                  ) : (
                    <IoEyeSharp size={16} className="text-gray500" />
                  )}
                </div>
              </div>

              {/* forgot password */}
              <button
                type="button"
                onClick={() => setForgotPasswordModal(true)}
                className=" text-sm mb-8 hover:font-bold globalTransition inline-block"
              >
                Forgot password
              </button>

              {/* Submit Button */}
              <div className="mb-4">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-black text-white font-semibold rounded-md hover:bg-opacity-20 globalTransition"
                >
                  {loginLoading ? <LoadingIcon /> : <span>Login</span>}
                </button>
              </div>
              {loginError && (
                <p className=" text-white text-sm font-semibold">
                  {loginErrorMsg}
                </p>
              )}
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
