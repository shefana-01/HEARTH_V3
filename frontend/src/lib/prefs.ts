/**
 * Display preferences kept on this device: how large the text is and whether
 * to use stronger contrast. They are applied as attributes on <html>, and the
 * whole interface is sized in rem, so everything scales together.
 */
import { readJSON, writeJSON } from './storage';

export type TextSize = 'standard' | 'large' | 'larger';

export interface DisplayPrefs {
  textSize: TextSize;
  highContrast: boolean;
}

const KEY = 'hearth.display';
const DEFAULTS: DisplayPrefs = { textSize: 'standard', highContrast: false };

export const TEXT_SIZES: { value: TextSize; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'The default size.' },
  { value: 'large', label: 'Large', description: 'Easier to read at arm’s length.' },
  { value: 'larger', label: 'Extra large', description: 'Biggest text and buttons.' },
];

export function getDisplayPrefs(): DisplayPrefs {
  return { ...DEFAULTS, ...readJSON<Partial<DisplayPrefs>>(KEY, {}) };
}

export function applyDisplayPrefs(prefs: DisplayPrefs = getDisplayPrefs()): void {
  const root = document.documentElement;
  root.dataset.textSize = prefs.textSize;
  root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
}

export function saveDisplayPrefs(prefs: DisplayPrefs): void {
  writeJSON(KEY, prefs);
  applyDisplayPrefs(prefs);
}
