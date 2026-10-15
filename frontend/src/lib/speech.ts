/**
 * Voice typing, built on the browser's Web Speech API (SpeechRecognition).
 *
 * Chrome, Edge and Safari provide it; Firefox does not, so every caller must check
 * `isVoiceTypingSupported()` and hide the microphone when it is false. Where it works, the
 * browser sends the audio to its own speech service (for example Google's in Chrome) and
 * returns text. Hearth never receives or stores the audio.
 *
 * TypeScript's DOM library does not describe this API, so the parts we use are declared here.
 */
import { getDisplayPrefs } from './prefs';

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
export interface RecognitionResultEvent {
  resultIndex: number;
  results: { readonly length: number; [index: number]: RecognitionResult };
}
export interface RecognitionErrorEvent {
  error: string;
}

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

function getConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isVoiceTypingSupported(): boolean {
  return getConstructor() !== undefined;
}

export function createRecognition(): Recognition | null {
  const Ctor = getConstructor();
  return Ctor ? new Ctor() : null;
}

/** The language to listen for: the one chosen in Settings → Display, else the browser's own. */
export function voiceLanguage(): string {
  const chosen = getDisplayPrefs().voiceLanguage;
  if (chosen !== 'auto') return chosen;
  return (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
}

/** Plain-language explanation for an error code from the speech service. */
export function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null; // Stopped on purpose.
    case 'no-speech':
      return 'I didn’t hear anything. Tap the microphone and try again.';
    case 'audio-capture':
      return 'No microphone was found on this device.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it for this site in your browser’s address bar, then try again.';
    case 'network':
      return 'Voice typing needs an internet connection.';
    case 'language-not-supported':
      return 'This language isn’t available for voice typing in your browser. Choose another in Settings.';
    default:
      return 'Voice typing stopped working. Please try again.';
  }
}

/** Start the sentence with a capital letter when it begins the field or follows a full stop. */
function shapeSentence(text: string, before: string): string {
  const startsSentence = before.trim() === '' || /[.!?।]\s*$/.test(before) || /\n\s*$/.test(before);
  return startsSentence ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Put `text` into a text field at the caret, the way typing would. Works with React's controlled
 * inputs: it sets the value through the native setter and fires a real `input` event, so the
 * component's own `onChange` runs and state stays in step.
 */
export function insertTextAtCaret(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const clean = text.trim();
  if (!clean) return;
  const value = el.value;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? start;
  const before = value.slice(0, start);
  const spacer = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const inserted = spacer + shapeSentence(clean, before);

  let next = before + inserted + value.slice(end);
  if (el.maxLength > 0 && next.length > el.maxLength) next = next.slice(0, el.maxLength);

  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, next);
  const caret = Math.min(before.length + inserted.length, next.length);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
