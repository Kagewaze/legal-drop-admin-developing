import { Navigate } from "react-router-dom";
import Login from "../pages/login";

export const ProtectedRoute = ({ children }) => {
  const checkUser = localStorage.getItem("CRMuser");

  if (checkUser) {
    return children;
  }

  return <Navigate to={"/login"} />;
};
