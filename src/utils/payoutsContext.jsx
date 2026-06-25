import React, { useState, useContext } from "react";
import customFetch from "./customFetch";
import { useGlobalContext } from "./context";

export const PayoutsContext = React.createContext();

export const PayoutsProvider = ({ children }) => {
  const [payouts, setPayouts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const { setGlobalLoading } = useGlobalContext();

  async function fetchPayouts(page = 1, limit = 10, order = "DESC", status) {
    setGlobalLoading(true);
    let url = `/payouts?page=${page}&limit=${limit}&order=${order}`;
    if (status) url += `&status=${status}`;
    try {
      const {
        data: { data, meta },
        status: resStatus,
      } = await customFetch(url);

      if (resStatus === 200) {
        setGlobalLoading(false);
        setPayouts(data);
        setPageCount(meta.pageCount);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  return (
    <PayoutsContext.Provider
      value={{
        payouts,
        setPayouts,
        fetchPayouts,
        currentPage,
        setCurrentPage,
        pageCount,
        setPageCount,
      }}
    >
      {children}
    </PayoutsContext.Provider>
  );
};

export const usePayoutsContext = () => {
  return useContext(PayoutsContext);
};
