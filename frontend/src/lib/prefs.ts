/**
 * Display preferences kept on this device: colour theme, how large the text is,
 * whether to use stronger contrast, and the language used for voice typing.
 * They are applied as attributes on <html>, and the whole interface is sized in
 * rem and coloured with CSS variables, so everything changes together.
 */
import { readJSON, writeJSON } from './storage';

export type TextSize = 'standard' | 'large' | 'larger';
/** `system` follows the device's light/dark setting and updates when it changes. */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
/** `auto` uses the browser's own language. */
export type VoiceLanguage = 'auto' | 'en-US' | 'en-GB' | 'bn-BD';

export interface DisplayPrefs {
  textSize: TextSize;
  highContrast: boolean;
  theme: ThemePreference;
  voiceLanguage: VoiceLanguage;
}

const KEY = 'hearth.display';
const DEFAULTS: DisplayPrefs = { textSize: 'standard', highContrast: false, theme: 'system', voiceLanguage: 'auto' };

/** Browser UI colour (address bar on phones) for each theme. Keep in step with `--c-primary-600` / `--c-canvas`. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#3C739C', dark: '#0E181D' };

export const TEXT_SIZES: { value: TextSize; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'The default size.' },
  { value: 'large', label: 'Large', description: 'Easier to read at arm’s length.' },
  { value: 'larger', label: 'Extra large', description: 'Biggest text and buttons.' },
];

export const THEMES: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'Match my device', description: 'Light or dark, like your phone or computer.' },
  { value: 'light', label: 'Light', description: 'Bright and airy.' },
  { value: 'dark', label: 'Dark', description: 'Easier on the eyes at night.' },
];

export const VOICE_LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: 'auto', label: 'Same as my browser' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'bn-BD', label: 'বাংলা (বাংলাদেশ)' },
];

/* ───────────────────────── store ───────────────────────── */

let current: DisplayPrefs | null = null;
const listeners = new Set<() => void>();

function read(): DisplayPrefs {
  const stored = readJSON<Partial<DisplayPrefs>>(KEY, {});
  return {
    textSize: TEXT_SIZES.some((o) => o.value === stored.textSize) ? (stored.textSize as TextSize) : DEFAULTS.textSize,
    highContrast: typeof stored.highContrast === 'boolean' ? stored.highContrast : DEFAULTS.highContrast,
    theme: THEMES.some((o) => o.value === stored.theme) ? (stored.theme as ThemePreference) : DEFAULTS.theme,
    voiceLanguage: VOICE_LANGUAGES.some((o) => o.value === stored.voiceLanguage) ? (stored.voiceLanguage as VoiceLanguage) : DEFAULTS.voiceLanguage,
  };
}

/** The current preferences. The same object is returned until they change (safe for useSyncExternalStore). */
export function getDisplayPrefs(): DisplayPrefs {
  current ??= read();
  return current;
}

export function subscribeDisplayPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const prefersDark = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
}

export function applyDisplayPrefs(prefs: DisplayPrefs = getDisplayPrefs()): void {
  const root = document.documentElement;
  const theme = resolveTheme(prefs.theme);
  root.dataset.textSize = prefs.textSize;
  root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function saveDisplayPrefs(prefs: DisplayPrefs): void {
  current = prefs;
  writeJSON(KEY, prefs);
  applyDisplayPrefs(prefs);
  listeners.forEach((listener) => listener());
}

/**
 * Apply the saved preferences and keep them live: follow the device's light/dark
 * setting while the theme is "Match my device", and pick up changes made in another tab.
 * Call once at start-up.
 */
export function startDisplayPrefs(): void {
  applyDisplayPrefs();
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getDisplayPrefs().theme === 'system') {
        applyDisplayPrefs();
        listeners.forEach((listener) => listener());
      }
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    current = read();
    applyDisplayPrefs(current);
    listeners.forEach((listener) => listener());
  });
}
