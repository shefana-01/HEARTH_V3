import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { aiService, getGeminiApiKey, getSelectedAiProvider, modeOf, setGeminiApiKey, setSelectedAiProvider, type AiMode, type AiModelProvider, type AiStatus } from '@/services/ai/aiService';

/**
 * AI help status and active free model provider (Google Gemini 2.5 Flash or ChatGPT 4o-mini),
 * shared across all components.
 */
let current: AiStatus | undefined;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = aiService
    .getStatus()
    .then((s) => {
      current = s;
    })
    .catch(() => {
      current = { enabled: false, consented: false, usedToday: 0, dailyLimit: 0, monthlyBudgetUsedPercent: 0 };
    })
    .finally(emit);
  return loading;
}

export function useAiStatus(): {
  status: AiStatus | undefined;
  mode: AiMode;
  provider: AiModelProvider;
  setProvider: (provider: AiModelProvider) => void;
  geminiKey: string | null;
  setGeminiKey: (key: string) => void;
  clearGeminiKey: () => void;
  refresh: () => Promise<void>;
  setConsent: (granted: boolean) => Promise<void>;
} {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );

  const provider = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getSelectedAiProvider(),
  );

  useEffect(() => {
    if (!current) void load();
  }, []);

  const refresh = useCallback(() => load(true), []);

  const setConsent = useCallback(async (granted: boolean) => {
    current = await aiService.setConsent(granted);
    emit();
  }, []);

  const handleSetProvider = useCallback((next: AiModelProvider) => {
    setSelectedAiProvider(next);
    emit();
  }, []);

  const geminiKey = getGeminiApiKey();

  const handleSetGeminiKey = useCallback((key: string) => {
    setGeminiApiKey(key);
    emit();
  }, []);

  const handleClearGeminiKey = useCallback(() => {
    setGeminiApiKey('');
    emit();
  }, []);

  return {
    status,
    mode: modeOf(status),
    provider,
    setProvider: handleSetProvider,
    geminiKey,
    setGeminiKey: handleSetGeminiKey,
    clearGeminiKey: handleClearGeminiKey,
    refresh,
    setConsent,
  };
}

/** For tests and sign-out: forget the cached status. */
export function resetAiStatus(): void {
  current = undefined;
  loading = null;
}
