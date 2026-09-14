import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, Check, CheckCheck, X } from 'lucide-react';
import { notificationService } from '@/services/notifications/notificationService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isSameDay, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { NOTIFICATION_TYPES } from '@/constants/labels';
import { useFamily } from '@/app/FamilyProvider';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, ListSkeleton, PageHeader, SegmentedControl, Select } from '@/components/ui';
import type { NotificationItem, NotificationType } from '@/types/domain';

const iconTone: Record<string, string> = {
  primary: 'bg-primary-100 text-primary-700',
  mint: 'bg-mint-100 text-mint-700',
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-600',
  neutral: 'bg-surface-sunken text-ink-muted',
};

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const { family } = useFamily();
  const data = useAsync(() => notificationService.list(), []);
  const [show, setShow] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const markAll = useMutation(notificationService.markAllRead);

  const items = data.data ?? [];
  const unread = items.filter((n) => !n.read).length;
  const shown = items.filter((n) => (show === 'all' || !n.read) && (type === 'all' || n.type === type));
  const today = shown.filter((n) => isSameDay(n.createdAt, new Date()));
  const earlier = shown.filter((n) => !isSameDay(n.createdAt, new Date()));
  const typesPresent = (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((t) => items.some((n) => n.type === t));

  const patchLocal = (fn: (list: NotificationItem[]) => NotificationItem[]) => data.setData((prev) => fn(prev ?? []));

  const markRead = async (n: NotificationItem) => {
    if (n.read) return;
    patchLocal((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await notificationService.markRead(n.id).catch(data.reload);
  };

  const dismiss = async (n: NotificationItem) => {
    patchLocal((list) => list.filter((x) => x.id !== n.id));
    await notificationService.dismiss(n.id).catch(data.reload);
  };

  const open = async (n: NotificationItem) => {
    await markRead(n);
    if (n.href) navigate(n.href);
  };

  const onMarkAll = async () => {
    if (await markAll.attempt()) patchLocal((list) => list.map((x) => ({ ...x, read: true })));
  };

  const renderGroup = (title: string, list: NotificationItem[]) =>
    list.length > 0 && (
      <section aria-labelledby={`group-${title}`} className="mb-6">
        <h2 id={`group-${title}`} className="eyebrow mb-2">
          {title}
        </h2>
        <Card padding="none">
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const meta = NOTIFICATION_TYPES[n.type];
              const Icon = meta.icon;
              return (
                <li key={n.id} className={cn('flex items-start gap-3 p-4 sm:gap-4', !n.read && 'bg-primary-50/50')}>
                  <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', iconTone[meta.tone])}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[15px]', n.read ? 'text-ink-muted' : 'font-semibold text-ink')}>
                      {!n.read && <span className="sr-only">Unread: </span>}
                      {n.message}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      <span>{meta.label}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
                    </p>
                    {n.href && (
                      <Button variant="soft" size="sm" className="mt-2" onClick={() => open(n)}>
                        View
                      </Button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.read && (
                      <IconButton label="Mark as read" size="sm" onClick={() => markRead(n)}>
                        <Check aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton label="Dismiss" size="sm" onClick={() => dismiss(n)}>
                      <X aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    );

  return (
    <>
      <PageHeader
        eyebrow={family?.name}
        title="Notifications"
        description="Updates from your circle — changes, conflicts and things that need a hand."
        meta={unread > 0 ? <Badge tone="primary">{unread} unread</Badge> : undefined}
        actions={
          <Button variant="secondary" onClick={onMarkAll} loading={markAll.pending} disabled={!unread} leftIcon={<CheckCheck aria-hidden="true" className="h-4 w-4" />}>
            Mark all as read
          </Button>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: 'all', label: `All (${items.length})` },
                { value: 'unread', label: `Unread (${unread})` },
              ]}
            />
            {typesPresent.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                Type
                <Select
                  className="w-auto font-normal"
                  value={type}
                  onChange={(e) => setType(e.target.value as NotificationType | 'all')}
                >
                  <option value="all">All types</option>
                  {typesPresent.map((t) => (
                    <option key={t} value={t}>
                      {NOTIFICATION_TYPES[t].label}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<BellOff aria-hidden="true" />}
              title={items.length ? 'You’re all caught up' : 'No notifications yet'}
              description={items.length ? 'Nothing matches this view.' : 'When tasks change hands, conflicts appear or someone reports time away, you’ll see it here.'}
            />
          ) : (
            <>
              {renderGroup('Today', today)}
              {renderGroup('Earlier', earlier)}
            </>
          )}
        </>
      )}
    </>
  );
}
