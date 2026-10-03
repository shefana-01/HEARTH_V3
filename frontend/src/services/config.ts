/** Runtime configuration read from Vite env variables (see `.env.example`). */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  useMocks: (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 350),
  /** ISO 4217 code used for grocery prices and budgets. */
  currency: (import.meta.env.VITE_CURRENCY as string | undefined) || 'BDT',
};

/** True while the app runs on local mock data instead of the API. Pages use it only to adjust wording. */
export const isDemoMode = config.useMocks;
