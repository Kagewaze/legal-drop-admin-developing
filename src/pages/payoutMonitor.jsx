import { useState } from "react";
import { PayoutDetails } from "../components/payouts/payoutDetails";
import { PayoutMonitorView } from "../components/payouts/monitorViews";
import { usePayoutMonitor } from "../components/payouts/usePayoutMonitor";

// Read-only payout monitoring. Every request it makes is a GET: usePayoutMonitor's, and PayoutDetails' for one payout.
export const PayoutMonitor = () => {
  const monitor = usePayoutMonitor();
  const [tab, setTab] = useState("payouts");
  const [viewId, setViewId] = useState(null);
  return (
    <>
      <PayoutMonitorView monitor={monitor} tab={tab} onTab={setTab} onView={setViewId} />
      {viewId ? <PayoutDetails id={viewId} closeModal={setViewId} /> : null}
    </>
  );
};
