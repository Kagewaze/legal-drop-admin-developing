import { apiErrorMessage } from "./driverReview.js";

export const NETWORK_ERROR_MESSAGE =
  "Network error occured, please check your internet connection";
export const AUTH_OTP_FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * The message to show when a forgot-password send or reset request fails.
 *
 * Any HTTP error response (400, 403, 429 rate limit, 500, 503 delivery failure, …) shows the
 * backend's user-safe message; a response without one shows a generic fallback. No response at
 * all (network failure, CORS, timeout) shows the network message. Always returns a string, so the
 * caller can never throw while reporting an error.
 */
export function authOtpErrorMessage(error) {
  if (!error?.response) return NETWORK_ERROR_MESSAGE;
  return apiErrorMessage(error, AUTH_OTP_FALLBACK_MESSAGE);
}
