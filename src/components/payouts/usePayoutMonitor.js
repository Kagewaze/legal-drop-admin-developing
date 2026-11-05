import { useCallback, useEffect, useRef, useState } from "react";
import customFetch from "../../utils/customFetch";
import { loadErrorOf } from "../../utils/payoutPayments";
import { MONITOR_STATUSES, PAGE_SIZE, QUEUE_LIMIT, REVIEW_LIMIT, RUN_LIMIT } from "../../utils/payoutMonitor";

const LOADING = { loading: true, error: null, value: null };
const INITIAL_FILTERS = { status: "", order: "DESC", page: 1 };

// ⚠️ READ-ONLY: this hook only ever sends GET requests. A read never throws; it answers { loading, error, value } with
// the response's `data` (and the list's `meta` beside it).
async function read(path, params) {
  try {
    const { data: body } = await customFetch.get(path, { params });
    return { loading: false, error: null, value: body?.meta ? { data: body.data, meta: body.meta } : body?.data ?? null };
  } catch (error) {
    return { loading: false, error: loadErrorOf(error), value: null };
  }
}
const countOf = (result) => (Number.isInteger(result.value?.meta?.itemCount) ? result.value.meta.itemCount : null);
const reloading = (part) => ({ ...part, loading: true, error: null });

/**
 * Everything the payout monitor shows. Each part keeps its own loading and error state, so one failed read never hides
 * the others; while a part reloads it keeps showing what it had. Only the latest load's answers are kept.
 */
export function usePayoutMonitor() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [generation, setGeneration] = useState(0);
  const [list, setList] = useState(LOADING);
  const [evidence, setEvidence] = useState({});
  const [overview, setOverview] = useState({
    counts: LOADING,
    runs: LOADING,
    queue: LOADING,
    unevidenced: LOADING,
    legacy: LOADING,
  });
  const listLoad = useRef(0);
  const overviewLoad = useRef(0);

  // The page of driver payouts, then what is recorded as paid for each payout on it.
  useEffect(() => {
    const mine = ++listLoad.current;
    setList(reloading);
    (async () => {
      const result = await read("/payouts", {
        page: filters.page,
        limit: PAGE_SIZE,
        order: filters.order,
        ...(filters.status ? { status: filters.status } : {}),
      });
      if (mine !== listLoad.current) return;
      setList(result);
      setEvidence({});
      const rows = Array.isArray(result.value?.data) ? result.value.data : [];
      const pairs = await Promise.all(rows.map(async (row) => [row.id, (await read(`/payouts/${row.id}/external-payments`)).value]));
      if (mine === listLoad.current) setEvidence(Object.fromEntries(pairs));
    })();
  }, [filters, generation]);

  // Counts by status (the list's own itemCount), transfer runs, the funding queue and the two exception lists.
  useEffect(() => {
    const mine = ++overviewLoad.current;
    setOverview((current) => Object.fromEntries(Object.entries(current).map(([key, part]) => [key, reloading(part)])));
    (async () => {
      const [runs, queue, unevidenced, legacy, all, ...byStatus] = await Promise.all([
        read("/payouts/transfer-runs", { limit: RUN_LIMIT }),
        read("/payouts/funding-queue", { limit: QUEUE_LIMIT }),
        read("/payouts/integrity/unevidenced-completions", { limit: REVIEW_LIMIT, offset: 0 }),
        read("/payouts/legacy-liabilities", { limit: REVIEW_LIMIT, offset: 0 }),
        read("/payouts", { page: 1, limit: 1 }),
        ...MONITOR_STATUSES.map((status) => read("/payouts", { page: 1, limit: 1, status })),
      ]);
      if (mine !== overviewLoad.current) return;
      const counts = {
        loading: false,
        error: [all, ...byStatus].every((result) => result.error) ? all.error : null,
        value: { all: countOf(all), ...Object.fromEntries(MONITOR_STATUSES.map((status, index) => [status, countOf(byStatus[index])])) },
      };
      setOverview({ counts, runs, queue, unevidenced, legacy });
    })();
  }, [generation]);

  const setFilter = useCallback((change) => setFilters((current) => ({ ...current, ...change, page: change.page ?? 1 })), []);
  const clearFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);
  const refresh = useCallback(() => setGeneration((value) => value + 1), []);

  return { filters, setFilter, clearFilters, refresh, list, evidence, ...overview };
}
