import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: Error | undefined;
  /** Re-run the request, keeping the current data visible. Resolves when it settles. */
  reload: () => Promise<void>;
  /** Update the cached data locally (e.g. after a mutation). */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Run an async loader and track loading / error / data.
 * Results from stale requests (deps changed or unmounted) are ignored. When deps change the
 * previous data is cleared (it belonged to something else); an explicit reload keeps it.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ status: AsyncStatus; data?: T; error?: Error }>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reloading = useRef(false);
  const waiters = useRef<(() => void)[]>([]);

  useEffect(() => {
    let active = true;
    const keep = reloading.current;
    reloading.current = false;
    setState((s) => ({ status: 'loading', data: keep ? s.data : undefined }));
    const settle = () => {
      const list = waiters.current;
      waiters.current = [];
      list.forEach((resolve) => resolve());
    };
    loaderRef
      .current()
      .then((data) => active && setState({ status: 'success', data }))
      .catch((error: unknown) => active && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }))
      .finally(() => active && settle());
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        reloading.current = true;
        setNonce((n) => n + 1);
      }),
    [],
  );
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setState((s) => ({
      status: 'success',
      data: typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(s.data) : updater,
    }));
  }, []);

  return { status: state.status, data: state.data, error: state.error, reload, setData };
}

/** Run a mutation with a pending flag and error capture. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  /** Like `run`, but resolves to whether it succeeded — use for operations that return nothing. */
  const attempt = useCallback(
    async (...args: A): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        await fnRef.current(...args);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { run, attempt, pending, error, setError };
}
