import { useCallback, useRef, useState } from 'react';

export const DEFAULT_API_TIMEOUT_MS = 9500;

export class FetchTimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(
      message ||
        `Permintaan melebihi batas waktu (${Math.round(timeoutMs / 1000)} detik). Periksa koneksi lalu coba lagi.`
    );
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Bounded fetch using AbortController so slow mobile networks or stalled backend
 * connections fail fast within 8-10 seconds instead of hanging for 1-2 minutes.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal: externalSignal, ...fetchInit } = options;
  const controller = new AbortController();
  let timedOut = false;

  const timerId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1500, timeoutMs));

  const handleExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timerId);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...fetchInit,
      signal: controller.signal
    });
  } catch (err: any) {
    if (timedOut || err?.name === 'AbortError') {
      if (externalSignal?.aborted && !timedOut) {
        throw err;
      }
      throw new FetchTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    window.clearTimeout(timerId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', handleExternalAbort);
    }
  }
}

export function isRetryableRequestError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof FetchTimeoutError) return true;
  const msg = String((err as Error)?.message || '').toLowerCase();
  return (
    msg.includes('batas waktu') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('koneksi')
  );
}

export interface OptimisticActionState {
  isSaving: boolean;
  error: string | null;
  canRetry: boolean;
}

/**
 * Reusable optimistic mutation controller with automatic rollback & retry handler.
 */
export function useOptimisticMutation() {
  const [state, setState] = useState<OptimisticActionState>({
    isSaving: false,
    error: null,
    canRetry: false
  });
  const lastRunnerRef = useRef<(() => Promise<boolean>) | null>(null);
  const inFlightRef = useRef(false);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, canRetry: false }));
  }, []);

  const execute = useCallback(
    async <T>(options: {
      applyOptimistic?: () => void;
      rollback?: () => void;
      request: () => Promise<T>;
      onSuccess?: (result: T) => void;
    }): Promise<boolean> => {
      if (inFlightRef.current) return false;

      const runOnce = async (): Promise<boolean> => {
        if (inFlightRef.current) return false;
        inFlightRef.current = true;
        setState({ isSaving: true, error: null, canRetry: false });
        options.applyOptimistic?.();
        try {
          const result = await options.request();
          options.onSuccess?.(result);
          lastRunnerRef.current = null;
          setState({ isSaving: false, error: null, canRetry: false });
          return true;
        } catch (err: any) {
          options.rollback?.();
          const msg = err?.message || 'Gagal menyimpan ke server. Periksa koneksi lalu coba lagi.';
          lastRunnerRef.current = runOnce;
          setState({ isSaving: false, error: msg, canRetry: true });
          return false;
        } finally {
          inFlightRef.current = false;
        }
      };

      return runOnce();
    },
    []
  );

  const retry = useCallback(async (): Promise<boolean> => {
    if (!lastRunnerRef.current || inFlightRef.current) return false;
    return lastRunnerRef.current();
  }, []);

  return {
    ...state,
    execute,
    retry,
    clearError
  };
}
