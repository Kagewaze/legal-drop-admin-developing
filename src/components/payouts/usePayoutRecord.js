import { useCallback, useEffect, useState } from "react";
import customFetch from "../../utils/customFetch";
import { loadErrorOf } from "../../utils/payoutPayments";

/**
 * One payout and everything recorded about its payment: GET /payouts/:id and GET /payouts/:id/external-payments,
 * loaded together so a decision is never made on half of it. `reload()` resolves to the fresh pair, or null.
 */
export function usePayoutRecord(id) {
  const [state, setState] = useState({ status: "loading", payout: null, evidence: null, error: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, status: previous.payout ? "refreshing" : "loading", error: null }));
    try {
      const [payoutResponse, evidenceResponse] = await Promise.all([
        customFetch.get(`/payouts/${id}`),
        customFetch.get(`/payouts/${id}/external-payments`),
      ]);
      const fresh = { payout: payoutResponse.data.data, evidence: evidenceResponse.data.data };
      setState({ status: "ready", ...fresh, error: null });
      return fresh;
    } catch (error) {
      setState({ status: "error", payout: null, evidence: null, error: loadErrorOf(error) });
      return null;
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
