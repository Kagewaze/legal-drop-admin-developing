/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on the component. */
import { canAssignOrder } from "../../utils/orderAssignment";

/**
 * The order page's "Assign Order" action, rendered only while the order is assignable (see
 * canAssignOrder). Props: order (the admin order row), onAssign() (opens the assign modal).
 */
export function AssignOrderButton({ order, onAssign }) {
  if (!canAssignOrder(order)) return null;
  return (
    <button
      type="button"
      onClick={onAssign}
      className=" border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs md:text-sm"
    >
      Assign Order
    </button>
  );
}
