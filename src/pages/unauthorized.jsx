import { Link } from "react-router-dom";

export const UnauthorizedPage = () => {
  return (
    <div className=" h-[20rem] mt-16 grid place-items-center text-center">
      <h1 className=" text-xl md:text-3xl">
        You are not authorized to access this page. Try another page or go to
        login
      </h1>
      <Link to="/login" className=" text-xl underline hover:text-primaryGreen">
        Go to Login Page
      </Link>
    </div>
  );
};
