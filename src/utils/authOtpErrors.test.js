import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_OTP_FALLBACK_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  authOtpErrorMessage,
} from "./authOtpErrors.js";

const httpError = (status, data) => ({
  message: `Request failed with status code ${status}`,
  response: { status, data },
});

test("every HTTP error status surfaces the backend's message", () => {
  const cases = [
    [400, "A valid email or phone number is required"],
    [403, "Invalid or expired code."],
    [429, "Please wait before requesting another code."],
    [500, "Internal server error"],
    [503, "We couldn't send your code right now. Please try again."],
  ];
  for (const [status, message] of cases) {
    assert.equal(authOtpErrorMessage(httpError(status, { statusCode: status, message })), message);
  }
});

test("validation message arrays are joined into one string", () => {
  assert.equal(authOtpErrorMessage(httpError(400, { message: ["code must be a string", "x"] })), "code must be a string, x");
});

test("an error response without a usable message shows the fallback", () => {
  assert.equal(authOtpErrorMessage(httpError(503, undefined)), AUTH_OTP_FALLBACK_MESSAGE);
  assert.equal(authOtpErrorMessage(httpError(429, "")), AUTH_OTP_FALLBACK_MESSAGE);
  assert.equal(authOtpErrorMessage(httpError(500, { message: "   " })), AUTH_OTP_FALLBACK_MESSAGE);
});

test("no response at all shows the network message and never throws", () => {
  assert.equal(authOtpErrorMessage(new Error("Network Error")), NETWORK_ERROR_MESSAGE);
  assert.equal(authOtpErrorMessage({ message: "timeout of 0ms exceeded", response: undefined }), NETWORK_ERROR_MESSAGE);
  assert.equal(authOtpErrorMessage(undefined), NETWORK_ERROR_MESSAGE);
  assert.equal(authOtpErrorMessage(null), NETWORK_ERROR_MESSAGE);
});

test("only the server's message string is shown, never the error object or request", () => {
  const error = httpError(429, { message: "Please wait before requesting another code." });
  error.config = { data: JSON.stringify({ userIdentifier: "a@b.c", metadata: { password: "secret-pw" } }) };
  error.stack = "Error: at internal.js:1";
  const shown = authOtpErrorMessage(error);
  assert.equal(typeof shown, "string");
  assert.ok(!shown.includes("secret-pw") && !shown.includes("a@b.c") && !shown.includes("internal.js"));
});
