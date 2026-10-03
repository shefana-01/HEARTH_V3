import { useEffect, type KeyboardEvent, type RefObject } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_LENGTH } from '@/services/chat/chatService';
import { cn } from '@/lib/cn';
import { Button, FormError, Textarea } from '@/components/ui';

const COUNTER_FROM = Math.floor(MAX_MESSAGE_LENGTH * 0.8);
const COUNTER_ID = 'chat-counter';

/**
 * Where you write to your family. Enter sends, Shift+Enter starts a new line. The box grows up to four
 * lines and keeps focus after sending (`inputRef` lets the page focus it).
 */
export function Composer({
  value,
  onChange,
  onSend,
  pending,
  error,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  error: string | null;
  inputRef: RefObject<HTMLTextAreaElement>;
}) {
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = value.trim().length > 0 && !tooLong && !pending;

  // Grow with the text, up to the max height set in the class list.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`; // content plus the border
  }, [value, inputRef]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (canSend) onSend();
  };

  return (
    <form
      className="shrink-0 space-y-2 border-t border-line bg-surface-muted/60 p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <FormError message={error} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="chat-message" className="sr-only">
            Message to your family
          </label>
          <Textarea
            id="chat-message"
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write to your family"
            aria-describedby={value.length >= COUNTER_FROM ? COUNTER_ID : undefined}
            aria-invalid={tooLong || undefined}
            className="max-h-[7.5rem] min-h-11 resize-none overflow-y-auto py-2.5"
          />
        </div>
        <Button type="submit" className="h-11 shrink-0 px-5" disabled={!canSend} loading={pending} rightIcon={<SendHorizontal aria-hidden="true" className="h-4 w-4" />}>
          Send
        </Button>
      </div>
      {value.length >= COUNTER_FROM && (
        <p id={COUNTER_ID} className={cn('text-right text-xs tabular-nums', tooLong ? 'font-semibold text-red-600' : 'text-ink-subtle')}>
          {value.length} / {MAX_MESSAGE_LENGTH}
        </p>
      )}
    </form>
  );
}
