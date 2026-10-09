import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads with `loader` when the component mounts and whenever `loader` changes, and gives the page
 * an awaitable `refresh()`. Only the latest request's answer is kept, so a slow earlier answer can
 * never overwrite a newer one. Nothing is cached: the value lives in this component's state only.
 *
 * `loader` must be stable (useCallback) and must never throw — the moderation API never does.
 */
export function useLoader(loader) {
  const [state, setState] = useState({ loading: true, value: null });
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    sequence.current += 1;
    const mine = sequence.current;
    setState((current) => ({ loading: true, value: current.value }));
    const value = await loader();
    if (mine === sequence.current) setState({ loading: false, value });
    return value;
  }, [loader]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading: state.loading, value: state.value, refresh };
}
