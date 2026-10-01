/* eslint-env node */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

import * as helpers from "./orderAssignment.js";

const { canAssignOrder } = helpers;

// Synthetic admin `admin/orders` rows. The backend stays the authority on assignment; the page only
// stops offering an action that cannot succeed.
const order = (over = {}) => ({
  id: "0b8a5d8e-4f0e-4c1f-9a51-2f1d7b1c9e01",
  trackingCode: "TRK-FIXTURE",
  status: "pending",
  paid: true,
  isAccepted: false,
  driverUserId: null,
  packagePickedUp: null,
  completedAt: null,
  cancellationStatus: null,
  ...over,
});

const INELIGIBLE = [
  // The production case: cancelled and refunded (e.g. 1JR2L3BBJG).
  ["a cancelled order", { status: "cancelled", cancellationStatus: "finalized" }],
  ["a cancelled order without a cancellation record", { status: "cancelled" }],
  ["an order with a cancellation in progress", { cancellationStatus: "pending" }],
  ["an order with a cancellation under review", { cancellationStatus: "needs_review" }],
  ["an assigned order", { status: "assigned", driverUserId: "driver-1" }],
  ["a pending order that already has a driver", { driverUserId: "driver-1" }],
  ["an accepted order", { isAccepted: true }],
  ["an ongoing order", { status: "ongoing", isAccepted: true, driverUserId: "driver-1" }],
  ["a picked-up order", { packagePickedUp: "2026-10-01T10:00:00.000Z" }],
  ["a completed order", { status: "delivered", completedAt: "2026-10-01T11:00:00.000Z" }],
  ["a refunded marketplace order", { status: "refunded", cancellationStatus: "finalized" }],
];

test("a pending, unassigned order with no cancellation is assignable", () => {
  assert.equal(canAssignOrder(order()), true);
  assert.equal(canAssignOrder(order({ isAccepted: undefined })), true);
});

for (const [label, over] of INELIGIBLE) {
  test(`${label} is not assignable`, () => {
    assert.equal(canAssignOrder(order(over)), false);
  });
}

test("a missing or still-loading order is not assignable and never throws", () => {
  assert.equal(canAssignOrder(null), false);
  assert.equal(canAssignOrder(undefined), false);
  // The order page's initial placeholder before the order is fetched.
  assert.equal(canAssignOrder({ id: "", status: "", driverUserId: undefined }), false);
});

// ── The button component, rendered ──

const require = createRequire(import.meta.url);
const buttonSource = readFileSync(new URL("../components/orders/assignOrderButton.jsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(buttonSource, "assignOrderButton.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const mod = { exports: {} };
new Function("require", "module", "exports", code)(
  (name) => (name === "../../utils/orderAssignment" ? helpers : require(name)),
  mod,
  mod.exports
);
const { AssignOrderButton } = mod.exports;
const noop = () => {};
const render = (o) => renderToStaticMarkup(React.createElement(AssignOrderButton, { order: o, onAssign: noop }));

test("the order page shows Assign Order for a pending unassigned order", () => {
  const markup = render(order());
  assert.match(markup, /<button[^>]*type="button"[^>]*>Assign Order<\/button>/);
});

for (const [label, over] of INELIGIBLE) {
  test(`the order page shows no Assign Order for ${label}`, () => {
    assert.equal(render(order(over)), "");
  });
}

test("the button opens the assignment through the page's own handler", () => {
  let opened = 0;
  const element = AssignOrderButton({ order: order(), onAssign: () => (opened += 1) });
  element.props.onClick();
  assert.equal(opened, 1);
});

test("the order page renders the button and the assign modal only through the same eligibility", () => {
  const page = readFileSync(new URL("../components/orders/singleOrder.jsx", import.meta.url), "utf8");
  assert.match(page, /<AssignOrderButton\s+order=\{order\}\s+onAssign=\{\(\) => setShowAssignOrder\(true\)\}\s*\/>/);
  assert.match(page, /\{showAssignOrder && canAssignOrder\(order\) && <AssignOrder orderId=\{id\} \/>\}/);
  // No unconditional Assign Order button is left on the page.
  assert.doesNotMatch(page, />\s*Assign Order\s*</);
});
