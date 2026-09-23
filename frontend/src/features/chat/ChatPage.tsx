import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { chatService } from '@/services/chat/chatService';
import { isDemoMode } from '@/services/config';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { PresenceStrip } from './PresenceStrip';
import { buildTimeline, mergeMessages } from './timeline';
import type { Message } from '@/types/domain';

const POLL_MS = 5000;
/** How close to the bottom (in pixels) still counts as "reading the newest messages". */
const NEAR_BOTTOM = 96;

/**
 * Fill the space under the top bar, above the phone tab bar. The main area reports the height of
 * whatever is pinned to the bottom of the screen in `--bottom-chrome`.
 */
const PAGE_HEIGHT =
  'h-[calc(100dvh-4rem-env(safe-area-inset-top)-1.5rem-var(--bottom-chrome))] sm:h-[calc(100dvh-4rem-env(safe-area-inset-top)-2rem-var(--bottom-chrome))] lg:h-[calc(100dvh-8rem)] min-h-[24rem]';

/** The family group chat. */
export default function ChatPage() {
  useDocumentTitle('Family chat');
  const thread = useAsync(() => chatService.list('family'), []);
  const { setData } = thread;
  const messages = useMemo(() => thread.data ?? [], [thread.data]);
  const [text, setText] = useState('');
  const send = useMutation(chatService.send);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followingRef = useRef(true);
  const newestRef = useRef<string | undefined>(undefined);
  newestRef.current = messages[messages.length - 1]?.createdAt;
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  const append = useCallback((incoming: Message[]) => setData((current) => mergeMessages(current ?? [], incoming)), [setData]);

  // Clear the unread badge whenever the conversation is opened or grows.
  const count = thread.data?.length;
  useEffect(() => {
    if (count === undefined) return;
    chatService
      .markRead('family')
      .then(() => chatService.refresh())
      .catch(() => undefined); // The badge simply stays until the next try.
  }, [count]);

  // Stay at the newest message, unless the reader has scrolled up to look at older ones.
  useEffect(() => {
    const el = logRef.current;
    if (el && followingRef.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  // With the real backend other people write too, so look for new messages every few seconds.
  const loaded = Boolean(thread.data);
  useEffect(() => {
    if (isDemoMode || !loaded) return;
    let active = true;
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const fresh = await chatService.list('family', newestRef.current);
        if (active && fresh.length) append(fresh);
      } catch {
        // Try again on the next round.
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loaded, append]);

  const onSend = async () => {
    const sent = await send.run('family', text);
    if (!sent) return;
    followingRef.current = true;
    append([sent]);
    setText('');
    inputRef.current?.focus();
  };

  const onScroll = () => {
    const el = logRef.current;
    if (el) followingRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
  };

  return (
    <div className={`flex flex-col ${PAGE_HEIGHT}`}>
      <PageHeader title="Family chat" description={isDemoMode ? 'In the demo you are the only person signed in, so nobody will answer.' : undefined} className="mb-3 shrink-0 sm:mb-4" />
      <PresenceStrip />
      <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* The log is a scrollable region, so keyboard users can reach it to scroll. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div ref={logRef} role="log" aria-live="polite" aria-label="Family messages" tabIndex={0} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {thread.status === 'error' ? (
            <ErrorState title="We couldn’t load the chat" message={thread.error?.message} onRetry={thread.reload} />
          ) : !thread.data ? (
            <ListSkeleton rows={4} />
          ) : messages.length === 0 ? (
            <EmptyState compact icon={<MessagesSquare aria-hidden="true" />} title="No messages yet" description="Say hello, or tell your family what you are up to." />
          ) : (
            <MessageList items={timeline} />
          )}
        </div>
        <Composer value={text} onChange={setText} onSend={onSend} pending={send.pending} error={send.error} inputRef={inputRef} />
      </Card>
    </div>
  );
}
