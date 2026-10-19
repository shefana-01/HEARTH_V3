import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck2, Check, FileText, Lock, MapPin, Pencil, Plus, Share2, StickyNote, Trash2, UserRound, Users, X } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { appointmentService } from '@/services/care/appointmentService';
import { taskService } from '@/services/tasks/taskService';
import { documentService } from '@/services/care/documentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatDuration, formatTime } from '@/lib/dates';
import { downloadIcs } from '@/lib/ics';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, ConfirmDialog, ErrorState, IconButton, Input, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { PrivateBadge } from '@/components/domain/People';

export default function AppointmentDetailPage() {
  const { appointmentId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { memberById, nameOf, personName } = useFamily();
  const data = useAsync(async () => {
    const [appt, tasks, docs] = await Promise.all([appointmentService.get(appointmentId), taskService.listTasks(), documentService.list()]);
    return { appt, tasks: tasks.filter((t) => t.appointmentId === appointmentId), docs: docs.filter((d) => d.appointmentId === appointmentId) };
  }, [appointmentId]);
  useDocumentTitle(data.data?.appt.title ?? 'Appointment');

  const [newPrep, setNewPrep] = useState('');
  const [prepError, setPrepError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = useMutation((prepId: string) => appointmentService.togglePrep(appointmentId, prepId));
  const add = useMutation((label: string) => appointmentService.addPrep(appointmentId, label));
  const removePrep = useMutation((prepId: string) => appointmentService.removePrep(appointmentId, prepId));
  const remove = useMutation(appointmentService.remove);

  if (data.status === 'loading' && !data.data) return <PageSkeleton />;
  if (data.status === 'error' || !data.data) return <ErrorState headingLevel="h1" title="We couldn’t open this appointment" message={data.error?.message} onRetry={data.reload} />;

  const { appt, tasks, docs } = data.data;
  const escort = memberById(appt.escortId);
  const ready = appt.prep.filter((p) => p.done).length;
  const end = new Date(new Date(appt.start).getTime() + appt.durationMin * 60_000).toISOString();
  const past = new Date(end).getTime() < Date.now();

  const updateAppt = (next: typeof appt | undefined) => next && data.setData((prev) => ({ ...prev!, appt: next }));

  const onAddPrep = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPrep.trim()) {
      setPrepError('Describe what needs preparing.');
      return;
    }
    setPrepError(undefined);
    updateAppt(await add.run(newPrep));
    setNewPrep('');
  };

  const share = async () => {
    const text = `${appt.title} for ${personName(appt.forId)} — ${formatDayTime(appt.start)}\n${appt.provider}, ${appt.location}\nGoing along: ${escort?.name ?? 'nobody yet'}`;
    try {
      if (navigator.share) await navigator.share({ title: appt.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard', description: 'Paste it into a message to share.' });
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/appointments', label: 'Back to appointments' }}
        eyebrow={
          <Badge tone={past ? 'neutral' : 'primary'} dot>
            {past ? 'Past visit' : 'Coming up'}
          </Badge>
        }
        title={appt.title}
        description={`${formatDayTime(appt.start)} – ${formatTime(end)} · ${formatDuration(appt.durationMin)}`}
        meta={
          <>
            <Badge tone="rose" size="md" className="gap-1">
              <UserRound aria-hidden="true" className="h-3 w-3" /> For {personName(appt.forId)}
            </Badge>
            {appt.visibility === 'private' && <PrivateBadge />}
            <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
              <MapPin aria-hidden="true" className="h-4 w-4" /> {appt.provider} · {appt.location}
            </span>
          </>
        }
        actions={
          <>
            <ButtonLink to={`/appointments/${appt.id}/edit`} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
              Edit
            </ButtonLink>
            <Button variant="secondary" onClick={share} leftIcon={<Share2 aria-hidden="true" className="h-4 w-4" />}>
              Share
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Going along" icon={<Users aria-hidden="true" className="h-5 w-5" />} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-muted p-4">
              <div className="flex items-center gap-3">
                {escort ? (
                  <Avatar name={escort.name} seed={escort.id} />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-subtle">?</span>
                )}
                <div>
                  <p className="font-semibold text-ink">{escort?.name ?? 'Nobody is going along yet'}</p>
                  <p className="text-[0.8125rem] text-ink-subtle">{escort ? 'Goes along and helps with getting there' : 'You can ask someone to come along.'}</p>
                </div>
              </div>
              {escort ? (
                <Badge tone="mint" dot size="md">
                  Told about it
                </Badge>
              ) : (
                <ButtonLink to={`/appointments/${appt.id}/edit`} size="sm">
                  Choose someone
                </ButtonLink>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="What to bring & prepare"
              action={
                <span className="text-[0.8125rem] font-semibold text-ink-muted">
                  {ready} of {appt.prep.length} ready
                </span>
              }
            />
            {appt.prep.length === 0 && <p className="mb-3 text-sm text-ink-subtle">Nothing listed yet.</p>}
            <ul className="space-y-2">
              {appt.prep.map((p) => (
                <li key={p.id} className="group flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={p.done}
                    aria-label={p.label}
                    onClick={async () => updateAppt(await toggle.run(p.id))}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                      p.done ? 'border-mint-600 bg-mint-600 text-white' : 'border-line-strong bg-surface hover:border-mint-400',
                    )}
                  >
                    {p.done && <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <span className={cn('flex-1 text-sm', p.done ? 'text-ink-subtle line-through' : 'text-ink')}>{p.label}</span>
                  {p.done && p.doneById && <span className="hidden text-xs text-ink-subtle sm:inline">by {nameOf(p.doneById).split(' ')[0]}</span>}
                  <IconButton label={`Remove “${p.label}”`} size="sm" onClick={async () => updateAppt(await removePrep.run(p.id))}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
            <form onSubmit={onAddPrep} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <label htmlFor="new-prep" className="sr-only">
                  New preparation item
                </label>
                <Input
                  id="new-prep"
                  value={newPrep}
                  onChange={(e) => setNewPrep(e.target.value)}
                  placeholder="e.g. Pack a water bottle and a cardigan"
                  aria-invalid={prepError ? true : undefined}
                  aria-describedby={prepError ? 'prep-error' : undefined}
                />
                {prepError && (
                  <p id="prep-error" className="mt-1.5 text-[0.8125rem] font-medium text-red-600">
                    {prepError}
                  </p>
                )}
              </div>
              <Button type="submit" variant="soft" loading={add.pending} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                Add
              </Button>
            </form>
          </Card>

          {appt.note && (
            <Card>
              <CardHeader title="Family note" icon={<StickyNote aria-hidden="true" className="h-5 w-5" />} />
              <p className="rounded-xl bg-rose-50 p-4 text-sm text-ink">{appt.note}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Related tasks" as="h3" />
            {tasks.length ? (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link to={`/tasks/${t.id}`} className="block rounded-xl bg-surface-muted px-3 py-2.5 hover:bg-surface-sunken">
                      <span className="block text-sm font-semibold text-ink">{t.title}</span>
                      <span className="block text-xs text-ink-subtle">
                        {formatDayTime(t.start)} · {t.assigneeId ? nameOf(t.assigneeId) : 'Needs someone'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-ink-subtle">No tasks linked yet.</p>
            )}
            <ButtonLink
              to={`/tasks/new?appointment=${appt.id}&category=transport&title=${encodeURIComponent(`Travel to ${appt.title}`)}`}
              variant="soft"
              size="sm"
              className="mt-3"
              leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            >
              Add a linked task
            </ButtonLink>
          </Card>
          <Card>
            <CardHeader title="Documents" as="h3" />
            {docs.length ? (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-ink">
                    <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-600" /> {d.title}
                    {d.access === 'restricted' && (
                      <>
                        <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                        <span className="sr-only">Restricted</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">No documents attached.</p>
            )}
            <ButtonLink to="/documents" variant="ghost" size="sm" className="mt-2">
              Go to documents
            </ButtonLink>
          </Card>
          <Card padding="sm" className="space-y-2">
            <Button
              block
              variant="secondary"
              leftIcon={<CalendarCheck2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => downloadIcs({ title: appt.title, start: appt.start, durationMin: appt.durationMin, location: appt.location, description: appt.provider })}
            >
              Add to my calendar
            </Button>
            <Button block variant="danger-ghost" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
              Delete appointment
            </Button>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this appointment?"
        description="It will be removed from the schedule. Linked tasks are kept."
        confirmLabel="Delete"
        variant="danger"
        loading={remove.pending}
        onConfirm={async () => {
          if (await remove.attempt(appt.id)) {
            toast({ title: 'Appointment deleted' });
            navigate('/appointments');
          } else {
            setConfirmDelete(false);
            toast({ tone: 'error', title: 'Couldn’t delete the appointment', description: 'Please try again.' });
          }
        }}
      />
    </>
  );
}
