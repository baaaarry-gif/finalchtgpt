import { useCallback, useEffect, useState } from "react";

/**
 * Persist a piece of state to localStorage so it survives reloads.
 * Note: localStorage data stays in THIS browser only — it is not synced
 * across devices.
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [key, state]);

  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) =>
        typeof value === "function" ? (value as (p: T) => T)(prev) : value
      );
    },
    []
  );

  return [state, set];
}

/** Re-renders on an interval so live counters stay current. */
export function useNow(intervalMs: number = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
