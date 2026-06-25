import axios from "axios";
import { toast } from "react-toastify";

export const baseUrl = window.env.REACT_APP_BASE_URL;
const customFetch = axios.create({
  baseURL: baseUrl,
});

customFetch.interceptors.request.use(
  (request) => {
    request.headers["Authorization"] = `Bearer ${localStorage.getItem(
      "CRMACCESSTOKEN"
    )}`;
    return request;
  },
  (error) => {
    return Promise.reject(error);
  }
);

customFetch.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.message.includes("Network Error")) {
      toast.error(
        "The server is currently unavailable. Please check your connection or try refreshing the page."
      );
    }

    const { status } = error?.response;

    if (status === 409 || status == 400 || status == 404) {
      toast.error(error.response.data.message);
    }

    if (status === 401) {
      window.location.href = "/unauthorized-page";
    }
    return Promise.reject(error);
  }
);

export default customFetch;
