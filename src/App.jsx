import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SharedLayout } from "./pages/sharedLayout";
import Login from "./pages/login";
import { ProtectedRoute } from "./components/protectedRoute";
import { Dashboard } from "./pages/dashboard";
import { Orders } from "./pages/orders";
import { Riders } from "./pages/riders";
import { Users } from "./pages/users";
import { UnauthorizedPage } from "./pages/unauthorized";
import { SingleOrder } from "./components/orders/singleOrder";
import { SingleUser } from "./components/users/singleUser";
import { SingleRider } from "./components/riders/singleRider";
import { Payouts } from "./pages/payouts";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CreateOrder } from "./pages/createOrder";
import { Contacts } from "./components/contacts";

function App() {
  return (
    <>
      <ToastContainer theme="dark" autoClose={3000} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SharedLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:singleUserId" element={<SingleUser />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:singleOrderId" element={<SingleOrder />} />
            <Route path="riders" element={<Riders />} />
            <Route path="riders/:singleRiderId" element={<SingleRider />} />
            <Route path="payouts" element={<Payouts />} />
            <Route path="unauthorized-page" element={<UnauthorizedPage />} />
            <Route path="create-order" element={<CreateOrder />} />
            <Route path="contacts" element={<Contacts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
