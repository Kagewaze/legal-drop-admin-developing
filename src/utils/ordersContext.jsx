import React, { useState, useContext } from "react";
import customFetch from "./customFetch";
import { useGlobalContext } from "./context";

export const OrdersContext = React.createContext();

export const OrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [showAssignOrder, setShowAssignOrder] = useState(false);
  const { setGlobalLoading } = useGlobalContext();
  const [showImage, setShowImage] = useState(false);

  async function fetchOrders(page = 1, limit = 10, status, fetchId, riderKey) {
    setGlobalLoading(true);
    const url = `admin/orders?page=${page}&limit=${limit}${
      status ? `&status=${status}` : ""
    }${fetchId && !riderKey ? `&userId=${fetchId}` : ""} ${
      riderKey ? `&riderId=${fetchId}` : ""
    } `;
    try {
      const {
        data: { data, meta },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setGlobalLoading(false);
        setOrders(data);
        setPageCount(meta.pageCount);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  return (
    <OrdersContext.Provider
      value={{
        orders,
        setOrders,
        fetchOrders,
        showAssignOrder,
        setShowAssignOrder,
        showImage,
        setShowImage,
        currentPage,
        setCurrentPage,
        pageCount,
        setPageCount,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrdersContext = () => {
  return useContext(OrdersContext);
};
