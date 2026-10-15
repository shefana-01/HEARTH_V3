import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createRecognition, insertTextAtCaret, isVoiceTypingSupported, voiceErrorMessage, voiceLanguage, type Recognition } from '@/lib/speech';

export interface VoiceTyping {
  /** False in browsers without the Web Speech API (e.g. Firefox). Hide the microphone then. */
  supported: boolean;
  listening: boolean;
  /** Words heard so far in the current phrase, not yet written into the field. */
  interim: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

/**
 * Dictate into a text field. Finished phrases are written at the caret as if typed, so the
 * field's own `onChange` and validation run as usual.
 */
export function useVoiceTyping(target: RefObject<HTMLInputElement | HTMLTextAreaElement>, enabled = true): VoiceTyping {
  const supported = enabled && isVoiceTypingSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const rec = createRecognition();
    if (!rec) return;
    setError(null);
    setInterim('');
    rec.lang = voiceLanguage();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let heard = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          if (target.current) insertTextAtCaret(target.current, result[0].transcript);
        } else {
          heard += result[0].transcript;
        }
      }
      setInterim(heard.trim());
    };
    rec.onerror = (event) => setError(voiceErrorMessage(event.error));
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim('');
    };

    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setError(voiceErrorMessage('unknown'));
    }
  }, [target]);

  const toggle = useCallback(() => {
    if (recognition.current) stop();
    else start();
  }, [start, stop]);

  // Never leave the microphone open after the field goes away.
  useEffect(
    () => () => {
      recognition.current?.abort();
      recognition.current = null;
    },
    [],
  );

  return { supported, listening, interim, error, toggle, stop };
}
