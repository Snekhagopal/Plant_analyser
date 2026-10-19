"use client";

import { useEffect, useState } from "react";
import { ApiError } from "./api";

/** Load data from the API once (and again on `retry`), tracking loading and user-safe errors. */
export function useApi<T>(load: () => Promise<T>, key: string = "") {
  const [state, setState] = useState<{ key: string; attempt: number; data?: T; error?: string }>({ key, attempt: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load()
      .then((data) => { if (live) setState({ key, attempt, data }); })
      .catch((e: unknown) => { if (live) setState({ key, attempt, error: e instanceof ApiError ? e.message : "Something went wrong." }); });
    return () => { live = false; };
    // `load` is recreated on every render; reload only when the key or attempt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = state.key === key && state.attempt === attempt;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    retry: () => setAttempt((n) => n + 1),
  };
}
