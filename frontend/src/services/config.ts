/** Runtime configuration read from Vite env variables (see `.env.example`). */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  useMocks: (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 350),
};
