export const appReducer = (state, action) => {
  if (action.type === "LOGIN") {
    return { ...state, authStatus: true };
  }

  if (action.type === "CLICK_NAV_LINK") {
    return { ...state, activePageId: action.payload };
  }

  if (action.type === "SET_ACTIVE_PAGE") {
    return { ...state, activePageId: action.payload };
  }

  if (action.type === "SET_ApiResponse_MSG") {
    return {
      ...state,
      apiResponseState: true,
      apiResponseMessage: action.payload,
    };
  }

  if (action.type === "DISABLE_ApiResponse_MSG") {
    return {
      ...state,
      apiResponseState: false,
      apiResponseMessage: "",
    };
  }

  return state;
};
