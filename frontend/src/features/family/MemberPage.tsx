import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, CalendarX2, CircleCheck, Clock, Mail, Pencil, Phone, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { familyService, type MemberUpdate } from '@/services/family/familyService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatClock, formatDayTime, formatShortDate } from '@/lib/dates';
import { maxLength, phone, validate } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { RELATION_SUGGESTIONS, ROLES, SKILLS, WEEKDAY_LABELS } from '@/constants/labels';
import { TaskRow } from '@/components/domain/TaskRow';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  FormField,
  Input,
  PageHeader,
  PageSkeleton,
  RadioCards,
  Skeleton,
  Switch,
  TabPanel,
  Tabs,
  ToggleChip,
  useToast,
} from '@/components/ui';
import type { FamilyMember, MemberRole, Skill } from '@/types/domain';

type Tab = 'overview' | 'schedule' | 'responsibilities' | 'access';

const ACCESS_SCOPES: { key: keyof FamilyMember['access']; label: string; description: string }[] = [
  { key: 'schedule', label: 'Schedule & tasks', description: 'See the family calendar and task list.' },
  { key: 'medical', label: 'Care details', description: 'See appointments, nutrition goals and care notes.' },
  { key: 'documents', label: 'Documents', description: 'See documents shared with the whole circle.' },
];

function todaysAvailability(m: FamilyMember): string {
  const idx = (new Date().getDay() + 6) % 7;
  if (!m.availability.days[idx]) return 'Not usually available today';
  if (!m.availability.windows.length) return 'Available today (no set hours)';
  return `Free today ${m.availability.windows.map((w) => `${formatClock(w.start)}–${formatClock(w.end)}`).join(', ')}`;
}

export default function MemberPage() {
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { memberById, me, isLead, refresh, status } = useFamily();
  const member = memberById(memberId);
  useDocumentTitle(member?.name ?? 'Member');
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const data = useAsync(() => Promise.all([taskService.listTasks({ assigneeId: memberId }), scheduleService.listUnavailability(memberId)]), [memberId]);
  const update = useMutation((patch: MemberUpdate) => familyService.updateMember(memberId, patch));
  const remove = useMutation(familyService.removeMember);

  if (status === 'loading') return <PageSkeleton />;
  if (!member) {
    return (
      <EmptyState
        icon={<UserX aria-hidden="true" />}
        headingLevel="h1"
        title="We couldn’t find that person"
        description="They may have been removed from the circle."
        action={<ButtonLink to="/family">Back to the family circle</ButtonLink>}
      />
    );
  }

  const isMe = member.id === me?.id;
  const canEdit = isLead || isMe;
  const canManage = isLead && member.role !== 'lead';
  const [tasks = [], absences = []] = data.data ?? [];
  const now = Date.now();
  const upcoming = tasks.filter((t) => t.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start));
  const done = tasks.filter((t) => t.status === 'completed').sort((a, b) => b.start.localeCompare(a.start));
  const futureAbsences = absences.filter((u) => new Date(u.end).getTime() > now).sort((a, b) => a.start.localeCompare(b.start));

  const setAccess = async (key: keyof FamilyMember['access'], value: boolean) => {
    const saved = await update.run({ access: { ...member.access, [key]: value } });
    if (saved) {
      await refresh();
      toast({ title: 'Access updated', description: `${member.name.split(' ')[0]} ${value ? 'can now' : 'can no longer'} see ${ACCESS_SCOPES.find((s) => s.key === key)!.label.toLowerCase()}.` });
    }
  };

  const onRemove = async () => {
    const ok = await remove.attempt(member.id);
    setRemoveOpen(false);
    if (ok) {
      await refresh();
      toast({ title: `${member.name} was removed`, description: 'Their open tasks are now unassigned.' });
      navigate('/family');
    } else {
      toast({ tone: 'error', title: 'Couldn’t remove this member', description: 'Please try again.' });
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Family circle', to: '/family' }, { label: member.name }]} title={<span className="sr-only">{member.name}</span>} className="mb-2 sm:mb-3" />

      <Card as="section" aria-labelledby="member-name" className="mb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <Avatar name={member.name} src={member.photo} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="member-name" className="font-display text-3xl leading-tight">
                {member.name}
              </h2>
              {isMe && <Badge>You</Badge>}
            </div>
            <p className="text-ink-muted">{member.relation || 'Relationship not set'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={member.role === 'lead' ? 'primary' : member.role === 'observer' ? 'neutral' : 'mint'}>{ROLES[member.role].label}</Badge>
              {member.status === 'invited' ? (
                <Badge tone="amber" dot>
                  Invitation pending
                </Badge>
              ) : (
                <Badge tone="mint" dot>
                  Active since {formatShortDate(member.joinedAt)}
                </Badge>
              )}
            </div>
            {member.focus && <p className="mt-3 text-[15px] text-ink">{member.focus}</p>}
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
              <li className="flex items-center gap-1.5">
                <Clock aria-hidden="true" className="h-4 w-4" /> {todaysAvailability(member)}
              </li>
              <li className="flex min-w-0 items-center gap-1.5">
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                <a className="truncate underline-offset-2 hover:underline" href={`mailto:${member.email}`}>
                  {member.email}
                </a>
              </li>
              {member.phone && (
                <li className="flex items-center gap-1.5">
                  <Phone aria-hidden="true" className="h-4 w-4" />
                  <a className="underline-offset-2 hover:underline" href={`tel:${member.phone.replace(/\s/g, '')}`}>
                    {member.phone}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditOpen(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                Edit profile
              </Button>
            )}
            {isMe && (
              <ButtonLink to="/schedule/availability" variant="soft" leftIcon={<CalendarClock aria-hidden="true" className="h-4 w-4" />}>
                My availability
              </ButtonLink>
            )}
            {canManage && (
              <Button variant="danger-ghost" onClick={() => setRemoveOpen(true)} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        label={`${member.name}’s details`}
        idPrefix="member"
        value={tab}
        onChange={setTab}
        className="mb-5"
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'schedule', label: 'Schedule' },
          { id: 'responsibilities', label: 'Responsibilities', count: data.data ? upcoming.length : undefined },
          { id: 'access', label: 'Access' },
        ]}
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : (
        <>
          <TabPanel idPrefix="member" id="overview" className={tab === 'overview' ? '' : 'hidden'}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Stat label="Open tasks" value={upcoming.length} loading={!data.data} note={upcoming[0] ? `Next: ${upcoming[0].title}, ${formatDayTime(upcoming[0].start)}` : 'Nothing scheduled'} />
              <Stat label="Completed" value={done.length} loading={!data.data} note="Tasks marked done in Hearth" />
              <Stat label="Time away" value={futureAbsences.length} loading={!data.data} note={futureAbsences[0] ? `From ${formatDayTime(futureAbsences[0].start)}` : 'No upcoming absences'} />
              <Card className="lg:col-span-3">
                <CardHeader title="Skills" description="Hearth uses skills when suggesting who could take a task." as="h3" />
                {member.skills.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {member.skills.map((s) => (
                      <li key={s}>
                        <Badge tone="mint" size="md">
                          {SKILLS[s]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-subtle">No skills added yet.</p>
                )}
              </Card>
            </div>
          </TabPanel>

          <TabPanel idPrefix="member" id="schedule" className={tab === 'schedule' ? '' : 'hidden'}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Usual week" as="h3" icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />} />
                <ul className="grid grid-cols-7 gap-1.5" aria-label="Days usually available">
                  {WEEKDAY_LABELS.map((d, i) => (
                    <li key={d} className={cn('rounded-xl py-2 text-center text-xs font-semibold', member.availability.days[i] ? 'bg-mint-100 text-mint-800' : 'bg-surface-sunken text-ink-subtle')}>
                      {d}
                      <span className="sr-only">{member.availability.days[i] ? ': available' : ': not available'}</span>
                    </li>
                  ))}
                </ul>
                <h4 className="mb-2 mt-5 text-sm font-semibold text-ink">Preferred hours</h4>
                {member.availability.windows.length ? (
                  <ul className="space-y-2">
                    {member.availability.windows.map((w) => (
                      <li key={w.id} className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
                        <span className="font-medium text-ink">{w.label}</span>
                        <span className="text-ink-muted">
                          {formatClock(w.start)} – {formatClock(w.end)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-subtle">No set hours — any time on available days.</p>
                )}
              </Card>
              <Card>
                <CardHeader title="Upcoming time away" as="h3" icon={<CalendarX2 aria-hidden="true" className="h-5 w-5" />} />
                {futureAbsences.length ? (
                  <ul className="space-y-2">
                    {futureAbsences.map((u) => (
                      <li key={u.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
                        <p className="font-medium text-ink">{u.reason}</p>
                        <p className="text-ink-muted">
                          {formatDayTime(u.start)} – {formatDayTime(u.end)}
                        </p>
                        {u.note && <p className="mt-1 text-ink-muted">{u.note}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-subtle">Nothing reported.</p>
                )}
                {isMe && (
                  <ButtonLink to="/schedule/unavailable" variant="soft" size="sm" className="mt-4">
                    Report time away
                  </ButtonLink>
                )}
              </Card>
            </div>
          </TabPanel>

          <TabPanel idPrefix="member" id="responsibilities" className={tab === 'responsibilities' ? '' : 'hidden'}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Scheduled" as="h3" icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />} />
                {upcoming.length ? (
                  <ul className="space-y-2">
                    {upcoming.map((t) => (
                      <li key={t.id}>
                        <TaskRow task={t} showDay />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-subtle">No scheduled tasks.</p>
                )}
              </Card>
              <Card>
                <CardHeader title="Recently completed" as="h3" icon={<CircleCheck aria-hidden="true" className="h-5 w-5" />} />
                {done.length ? (
                  <ul className="space-y-2">
                    {done.slice(0, 8).map((t) => (
                      <li key={t.id}>
                        <TaskRow task={t} showDay />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-subtle">Nothing completed yet.</p>
                )}
              </Card>
            </div>
          </TabPanel>

          <TabPanel idPrefix="member" id="access" className={tab === 'access' ? '' : 'hidden'}>
            <Card>
              <CardHeader
                title="What they can see"
                as="h3"
                icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
                description={member.role === 'lead' ? 'The lead caregiver always has full access.' : isLead ? 'Changes save straight away.' : 'Only the lead caregiver can change access.'}
              />
              <FormError message={update.error} />
              <div className="divide-y divide-line">
                {ACCESS_SCOPES.map((s) => (
                  <div key={s.key} className="py-3 first:pt-0 last:pb-0">
                    <Switch checked={member.access[s.key]} onChange={(v) => setAccess(s.key, v)} label={s.label} description={s.description} disabled={!canManage || update.pending} />
                  </div>
                ))}
              </div>
              <Callout tone="neutral" className="mt-4">
                Documents marked “restricted” are only visible to the people chosen on each document, whatever this setting says.{' '}
                <Link to="/documents" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
                  Manage documents
                </Link>
              </Callout>
            </Card>
          </TabPanel>
        </>
      )}

      {canEdit && (
        <MemberEditDialog
          member={member}
          allowRole={canManage}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            await refresh();
            toast({ title: 'Profile saved' });
          }}
        />
      )}
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={onRemove}
        loading={remove.pending}
        variant="danger"
        title={`Remove ${member.name} from the circle?`}
        description={`Their ${upcoming.length} open task${upcoming.length === 1 ? '' : 's'} will become unassigned so someone else can pick ${upcoming.length === 1 ? 'it' : 'them'} up.`}
        confirmLabel="Remove"
      />
    </>
  );
}

function Stat({ label, value, note, loading }: { label: string; value: number; note: string; loading: boolean }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-12" />
          <Skeleton className="mt-2 h-4 w-40" />
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl">{value}</p>
          <p className="mt-1 text-sm text-ink-muted">{note}</p>
        </>
      )}
    </Card>
  );
}

interface EditDraft {
  relation: string;
  focus: string;
  phone: string;
  role: MemberRole;
  skills: Skill[];
}

function MemberEditDialog({ member, allowRole, open, onClose, onSaved }: { member: FamilyMember; allowRole: boolean; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toDraft = (m: FamilyMember): EditDraft => ({ relation: m.relation, focus: m.focus, phone: m.phone ?? '', role: m.role, skills: [...m.skills] });
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(member));
  const [errors, setErrors] = useState<Partial<Record<'phone' | 'focus', string>>>({});
  const save = useMutation((patch: MemberUpdate) => familyService.updateMember(member.id, patch));

  useEffect(() => {
    if (open) {
      setDraft(toDraft(member));
      setErrors({});
    }
  }, [open, member]);

  const toggleSkill = (s: Skill) => setDraft((d) => ({ ...d, skills: d.skills.includes(s) ? d.skills.filter((x) => x !== s) : [...d.skills, s] }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { phone: validate(draft.phone, phone), focus: validate(draft.focus, maxLength('Focus', 80)) };
    setErrors(next);
    if (next.phone || next.focus) return;
    const saved = await save.run({
      relation: draft.relation.trim(),
      focus: draft.focus.trim(),
      phone: draft.phone.trim() || undefined,
      skills: draft.skills,
      ...(allowRole ? { role: draft.role } : {}),
    });
    if (saved) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`Edit ${member.name.split(' ')[0]}’s profile`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-edit-form" loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <form id="member-edit-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Relationship">
            {(p) => (
              <>
                <Input {...p} list="member-relations" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} />
                <datalist id="member-relations">
                  {RELATION_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>
          <FormField label="Phone" hint="Optional" error={errors.phone}>
            {(p) => <Input {...p} type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />}
          </FormField>
        </div>
        <FormField label="Household focus" hint="e.g. Errands & weekend drives" error={errors.focus}>
          {(p) => <Input {...p} value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} />}
        </FormField>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Skills</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SKILLS) as Skill[]).map((s) => (
              <ToggleChip key={s} pressed={draft.skills.includes(s)} onClick={() => toggleSkill(s)}>
                {SKILLS[s]}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        {allowRole && (
          <RadioCards
            name="member-role"
            legend="Role"
            columns={2}
            value={draft.role}
            onChange={(role) => setDraft({ ...draft, role })}
            options={(['contributor', 'observer'] as const).map((r) => ({ value: r, label: ROLES[r].label, description: ROLES[r].description }))}
          />
        )}
      </form>
    </Dialog>
  );
}
