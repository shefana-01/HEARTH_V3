/** Stand-in for vite-plugin-pwa's virtual module in unit tests (the plugin is not loaded there). */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
