import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VoiceTyping } from '@/hooks/useVoiceTyping';

/** Microphone button that sits inside a text field. Starts and stops dictation. */
export function VoiceButton({ voice, className }: { voice: VoiceTyping; className?: string }) {
  const label = voice.listening ? 'Stop voice typing' : 'Start voice typing';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={voice.listening}
      title={label}
      onClick={voice.toggle}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
        voice.listening ? 'animate-pulse bg-rose-100 text-rose-700 ring-2 ring-rose-300' : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      {voice.listening ? <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" /> : <Mic aria-hidden="true" className="h-[18px] w-[18px]" />}
    </button>
  );
}

/**
 * Tells the person what the microphone is doing: listening, what it has heard so far, or why
 * it stopped. Announced politely to screen readers.
 */
export function VoiceStatus({ voice }: { voice: VoiceTyping }) {
  const text = voice.error ?? (voice.listening ? (voice.interim ? `Listening… “${voice.interim}”` : 'Listening… speak now, then tap the square to stop.') : '');
  return (
    <p role={voice.error ? 'alert' : 'status'} aria-live="polite" className={cn('text-[0.8125rem]', text ? 'mt-1.5 block' : 'sr-only', voice.error ? 'font-medium text-red-600' : 'text-ink-subtle')}>
      {text}
    </p>
  );
}
