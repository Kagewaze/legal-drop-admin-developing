import React, { useState, useContext, useReducer, useEffect } from "react";
import { appReducer } from "./reducer";

export const AppContext = React.createContext();

const defaultState = {
  activePageId: 0,
  activePage: "",
  authStatus: false,
  apiResponseMessage: "",
  apiResponseState: false,
};

export const AppProvider = ({ children }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const [state, dispatch] = useReducer(appReducer, defaultState);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showForgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [showResetPasswordModal, setResetPasswordModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [senderlatitude, setSenderLatitude] = useState(null);
  const [senderlongitude, setSenderLongitude] = useState(null);
  const defaultFormData = {
    sender: {
      senderCorordinates: "",
      senderAddress: "",
      senderName: "",
      senderPhone: "",
      senderEmail: "",
      senderNote: "",
      senderAltPhone: "",
      vehicle: "",
      paymentMethod: "",
      type: "",
      pickUpTime: "",
      section: "",
      price: "",
    },
    receiver: {
      receiverName: "",
      receiverPhone: "",
      receiverEmail: "",
      receiverLocation: {
        latitude: 0,
        longitude: 0,
      },
      receiverAddress: "",
      receiverNote: "",
      receiverAltPhone: "",
      weight: "",
      quantity: "",
      value: "",
      distance: "",
      topPriority: true,
      fragility: "",
      categories: "",
      itemImages: [],
    },
  };
  const [senderForm, setSenderForm] = useState({
    ...defaultFormData.sender,
  });
  const [receiversForm, setReceiversForm] = useState([
    defaultFormData.receiver,
  ]);

  useEffect(() => {
    // Add an event listener to update the window width when it changes
    window.addEventListener("resize", handleResize);
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        dispatch,
        windowWidth,
        globalLoading,
        setGlobalLoading,
        showForgotPasswordModal,
        setForgotPasswordModal,
        showResetPasswordModal,
        setResetPasswordModal,
        searchTerm,
        setSearchTerm,
        changePasswordModal,
        setChangePasswordModal,
        apiKey,
        senderlongitude,
        setSenderLongitude,
        senderlatitude,
        setSenderLatitude,
        defaultFormData,
        senderForm,
        setSenderForm,
        receiversForm,
        setReceiversForm,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => {
  return useContext(AppContext);
};
