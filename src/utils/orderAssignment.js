// Whether the order page should offer "Assign Order". The backend (admin assign-order) stays the
// authority and re-checks everything under the order lock; this only stops the page from offering an
// action that cannot succeed — e.g. on an order that is already cancelled and refunded.

/** A pending order with no driver, not accepted, not picked up or completed, and no cancellation. */
export function canAssignOrder(order) {
  if (!order || typeof order !== "object" || !order.id) return false;
  return (
    order.status === "pending" &&
    order.cancellationStatus == null &&
    order.driverUserId == null &&
    order.isAccepted !== true &&
    !order.packagePickedUp &&
    order.completedAt == null
  );
}
