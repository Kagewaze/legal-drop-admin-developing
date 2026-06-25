import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AppProvider } from "./utils/context.jsx";
import { OrdersProvider } from "./utils/ordersContext.jsx";
import { PayoutsProvider } from "./utils/payoutsContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <OrdersProvider>
        <PayoutsProvider>
          <App />
        </PayoutsProvider>
      </OrdersProvider>
    </AppProvider>
  </React.StrictMode>
);
