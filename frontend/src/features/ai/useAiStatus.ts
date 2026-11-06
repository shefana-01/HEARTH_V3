import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { aiService, getGeminiApiKey, modeOf, setGeminiApiKey, type AiMode, type AiStatus } from '@/services/ai/aiService';

/**
 * AI help status, shared by every component that shows an AI button. Loaded once per session and kept in
 * step when the person turns AI help on or off anywhere in the app or configures a Gemini API key.
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
      // Unreachable ai-service: behave as if AI help were off, so everything keeps working in basic mode.
      current = { enabled: false, consented: false, usedToday: 0, dailyLimit: 0, monthlyBudgetUsedPercent: 0 };
    })
    .finally(emit);
  return loading;
}

export function useAiStatus(): {
  status: AiStatus | undefined;
  mode: AiMode;
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

  useEffect(() => {
    if (!current) void load();
  }, []);

  const refresh = useCallback(() => load(true), []);

  const setConsent = useCallback(async (granted: boolean) => {
    current = await aiService.setConsent(granted);
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
