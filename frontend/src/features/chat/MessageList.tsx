import { useFamily } from '@/app/FamilyProvider';
import { formatRelativeDay, formatTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui';
import type { TimelineItem } from './timeline';

function TextBubble({ item, mine }: { item: Extract<TimelineItem, { kind: 'message' }>; mine: boolean }) {
  const { memberById, firstNameOf } = useFamily();
  const { message, startsRun } = item;
  const author = memberById(message.authorId);
  const name = firstNameOf(message.authorId);

  return (
    <li className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start', startsRun ? 'mt-3' : 'mt-1')}>
      {!mine && (author ? <Avatar name={author.name} src={author.photo} size="sm" className={cn(!startsRun && 'invisible')} /> : <span aria-hidden="true" className="w-8 shrink-0" />)}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]', mine ? 'items-end' : 'items-start')}>
        {!mine && startsRun && <span className="mb-0.5 px-1 text-xs font-semibold text-ink-muted">{name}</span>}
        <p
          className={cn(
            'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.9375rem] text-ink',
            mine ? 'rounded-br-md bg-primary-100' : 'rounded-bl-md border border-line bg-surface-muted',
          )}
        >
          {message.text}
        </p>
        <time dateTime={message.createdAt} className="mt-0.5 px-1 text-xs text-ink-subtle">
          {formatTime(message.createdAt)}
        </time>
      </div>
    </li>
  );
}

/** The conversation, oldest first, with day dividers, text bubbles, status pills and Hearth’s own notes. */
export function MessageList({ items }: { items: TimelineItem[] }) {
  const { me, firstNameOf } = useFamily();

  return (
    <ul className="list-none">
      {items.map((item) => {
        if (item.kind === 'day') {
          return (
            <li key={item.key} className="mb-1 mt-4 flex justify-center first:mt-0">
              <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-semibold text-ink-muted">{formatRelativeDay(item.at)}</span>
            </li>
          );
        }
        const { message } = item;
        if (message.kind === 'status') {
          return (
            <li key={item.key} className="mt-3 flex justify-center">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-center text-[0.8125rem] text-primary-800">
                {firstNameOf(message.authorId)}: {message.text}
              </span>
            </li>
          );
        }
        if (message.kind === 'system') {
          return (
            <li key={item.key} className="mt-3 text-center text-[0.8125rem] text-ink-subtle">
              {message.text}
            </li>
          );
        }
        return <TextBubble key={item.key} item={item} mine={message.authorId === me?.id} />;
      })}
    </ul>
  );
}
