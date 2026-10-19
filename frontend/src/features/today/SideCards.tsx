import { Link } from 'react-router-dom';
import { CalendarDays, MessageCircle, Salad } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { scheduleService } from '@/services/schedule/scheduleService';
import { healthService } from '@/services/care/healthService';
import { chatService } from '@/services/chat/chatService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync } from '@/hooks/useAsync';
import { isSameDay, formatTimeRange } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { Badge, Card, CardHeader, ErrorState, ListSkeleton } from '@/components/ui';
import type { Message, NutritionTag, ScheduleEvent } from '@/types/domain';

const linkClass = 'inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-primary-700 hover:underline';

const KIND_LABELS: Record<ScheduleEvent['kind'], string> = {
  event: 'My schedule',
  task: 'Task',
  conflict: 'Task',
  completed: 'Task',
  appointment: 'Appointment',
  unavailable: 'Away',
  busy: 'Busy',
};

function CardError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return <ErrorState headingLevel="h3" title="We couldn’t load this" message={message} onRetry={onRetry} />;
}

export function ScheduleCard() {
  const { me } = useFamily();
  const week = useAsync(() => scheduleService.getWeek(new Date()), []);
  const today = (week.data ?? []).filter((e) => (e.memberId === me?.id || e.alsoMemberId === me?.id) && isSameDay(e.start, new Date())).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Card>
      <CardHeader
        title="My schedule today"
        icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
        action={
          <Link to="/schedule" className={linkClass}>
            Full schedule
          </Link>
        }
      />
      {week.status === 'error' ? (
        <CardError message={week.error?.message} onRetry={week.reload} />
      ) : !week.data ? (
        <ListSkeleton rows={3} />
      ) : today.length ? (
        <ul className="space-y-2">
          {today.map((e) => {
            const body = (
              <>
                <span className="w-[5.5rem] shrink-0 text-xs font-semibold leading-5 tabular-nums text-ink-subtle">{formatTimeRange(e.start, e.end)}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[0.8125rem] font-semibold text-ink', e.kind === 'completed' && 'text-ink-subtle line-through')}>{e.title}</span>
                  <span className="block text-xs text-ink-subtle">{KIND_LABELS[e.kind]}</span>
                </span>
              </>
            );
            return (
              <li key={`${e.kind}-${e.id}`}>
                {e.href ? (
                  <Link to={e.href} className="flex gap-3 rounded-xl bg-surface-muted px-3 py-2.5 hover:bg-surface-sunken">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 rounded-xl bg-surface-muted px-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Nothing on your schedule today.{' '}
          <Link to="/schedule/events/new" className="font-semibold text-primary-700 hover:underline">
            Add an event
          </Link>
        </p>
      )}
    </Card>
  );
}

export function FoodCard() {
  const { me } = useFamily();
  const foods = useAsync(() => healthService.getSuggestions(me?.id), [me?.id]);
  const top = (foods.data ?? []).slice(0, 3);

  return (
    <Card>
      <CardHeader
        title="Food for you"
        icon={<Salad aria-hidden="true" className="h-5 w-5" />}
        action={
          <Link to="/health" className={linkClass}>
            Health notes
          </Link>
        }
      />
      {foods.status === 'error' ? (
        <CardError message={foods.error?.message} onRetry={foods.reload} />
      ) : !foods.data ? (
        <ListSkeleton rows={2} />
      ) : top.length ? (
        <ul className="space-y-3">
          {top.map((f) => {
            const tags = [...new Set(f.reasons.flatMap((r) => r.tags))] as NutritionTag[];
            return (
              <li key={f.id}>
                <p className="text-sm font-semibold text-ink">{f.name}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} tone="mint">
                      {NUTRITION_TAG_LABELS[t]}
                    </Badge>
                  ))}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">Because of “{f.reasons[0].because}”</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Add a health note (for example low iron) and Hearth will suggest foods for the shopping list.{' '}
          <Link to={`/health/${me?.id ?? ''}`} className="font-semibold text-primary-700 hover:underline">
            Add a health note
          </Link>
        </p>
      )}
      <p className="mt-4 text-xs text-ink-subtle">General food guidance, not medical advice.</p>
    </Card>
  );
}

function ChatLine({ message }: { message: Message }) {
  const { firstNameOf } = useFamily();
  if (message.kind === 'system') return <p className="text-[0.8125rem] italic text-ink-subtle">{message.text}</p>;
  if (message.kind === 'status') {
    return (
      <p className="text-[0.8125rem] italic text-ink-subtle">
        {firstNameOf(message.authorId)} updated their status: “{message.text}”
      </p>
    );
  }
  return (
    <p className="line-clamp-2 text-[0.8125rem] text-ink-muted">
      <span className="font-semibold text-ink">{firstNameOf(message.authorId)}</span> {message.text}
    </p>
  );
}

export function FamilyCard() {
  const data = useAsync(async () => {
    const [messages, attention] = await Promise.all([chatService.list('family'), decisionService.listAttention()]);
    return { messages: messages.slice(-2), unread: chatService.unreadCount(), needSomeone: attention.length };
  }, []);
  const { messages = [], unread = 0, needSomeone = 0 } = data.data ?? {};

  return (
    <Card>
      <CardHeader
        title="Family"
        icon={<MessageCircle aria-hidden="true" className="h-5 w-5" />}
        action={
          <Link to="/chat" className={linkClass}>
            Open chat
          </Link>
        }
      />
      {data.status === 'error' ? (
        <CardError message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={2} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">{unread === 0 ? 'No unread messages' : unread === 1 ? '1 unread message' : `${unread} unread messages`}</p>
          {messages.length > 0 && (
            <ul className="space-y-1.5">
              {messages.map((m) => (
                <li key={m.id}>
                  <ChatLine message={m} />
                </li>
              ))}
            </ul>
          )}
          {needSomeone > 0 && (
            <Link to="/priority" className="block rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100">
              {needSomeone === 1 ? '1 task needs someone' : `${needSomeone} tasks need someone`}
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
