import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Clock, Mail, Pencil, Phone, Trash2, UserX } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { familyService, type MemberUpdate } from '@/services/family/familyService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatClock, formatShortDate } from '@/lib/dates';
import { ROLES } from '@/constants/labels';
import { activeStatus } from '@/components/domain/People';
import { Avatar, Badge, Button, ButtonLink, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, PageSkeleton, TabPanel, Tabs, useToast } from '@/components/ui';
import { MemberEditDialog } from './MemberEditDialog';
import { ACCESS_SCOPES } from './accessScopes';
import { AccessPanel, OverviewPanel, SchedulePanel, TasksPanel } from './MemberPanels';
import type { FamilyMember } from '@/types/domain';

type Tab = 'overview' | 'schedule' | 'tasks' | 'access';

function todaysAvailability(m: FamilyMember): string {
  const idx = (new Date().getDay() + 6) % 7;
  if (!m.availability.days[idx]) return 'Not usually free today';
  if (!m.availability.windows.length) return 'Free today (no set hours)';
  return `Free today ${m.availability.windows.map((w) => `${formatClock(w.start)}–${formatClock(w.end)}`).join(', ')}`;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

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
        description="They may have been removed from the family."
        action={<ButtonLink to="/family">Back to the family hub</ButtonLink>}
      />
    );
  }

  const isMe = member.id === me?.id;
  const first = member.name.split(' ')[0];
  const canEdit = isLead || isMe;
  const canManage = isLead && member.role !== 'lead';
  const statusLine = member.status === 'active' ? activeStatus(member) : null;
  const [tasks = [], absences = []] = data.data ?? [];
  const shared = tasks.filter((t) => t.visibility === 'family');
  const upcoming = shared.filter((t) => t.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start));
  const done = shared.filter((t) => t.status === 'completed').sort((a, b) => b.start.localeCompare(a.start));
  const futureAbsences = absences.filter((u) => new Date(u.end).getTime() > Date.now()).sort((a, b) => a.start.localeCompare(b.start));

  const setAccess = async (key: keyof FamilyMember['access'], value: boolean) => {
    const saved = await update.run({ access: { ...member.access, [key]: value } });
    if (saved) {
      await refresh();
      toast({ title: 'Access updated', description: `${first} ${value ? 'can now' : 'can no longer'} ${lowerFirst(ACCESS_SCOPES.find((s) => s.key === key)!.description)}.` });
    }
  };

  const onRemove = async () => {
    const ok = await remove.attempt(member.id);
    setRemoveOpen(false);
    if (ok) {
      await refresh();
      toast({ title: `${member.name} was removed`, description: 'Their shared tasks now need someone.' });
      navigate('/family');
    } else {
      toast({ tone: 'error', title: 'Couldn’t remove them', description: 'Please try again.' });
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Family hub', to: '/family' }, { label: member.name }]} title={<span className="sr-only">{member.name}</span>} className="mb-2 sm:mb-3" />

      <Card as="section" aria-labelledby="member-name" className="mb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <Avatar name={member.name} src={member.photo} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="member-name" className="font-display text-3xl leading-tight">
                {member.name}
              </h2>
              {isMe && <Badge>Me</Badge>}
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
                  In the family since {formatShortDate(member.joinedAt)}
                </Badge>
              )}
            </div>
            {statusLine && <p className="mt-3 text-[0.9375rem] italic text-ink-muted">“{statusLine}”</p>}
            {isMe && (
              <Link to="/today" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 underline-offset-2 hover:underline">
                Change my status
              </Link>
            )}
            {member.focus && <p className="mt-2 text-[0.9375rem] text-ink">{member.focus}</p>}
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
              <Button variant="secondary" className="h-11" onClick={() => setEditOpen(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                {isMe ? 'Edit my profile' : 'Edit profile'}
              </Button>
            )}
            {isMe && (
              <ButtonLink to="/schedule/availability" variant="soft" className="h-11" leftIcon={<CalendarClock aria-hidden="true" className="h-4 w-4" />}>
                When I’m free
              </ButtonLink>
            )}
            {canManage && (
              <Button variant="danger-ghost" className="h-11" onClick={() => setRemoveOpen(true)} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}>
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
          { id: 'tasks', label: 'Shared tasks', count: data.data ? upcoming.length : undefined },
          { id: 'access', label: 'Access' },
        ]}
      />

      {data.status === 'error' && tab !== 'access' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : (
        <>
          <TabPanel idPrefix="member" id="overview" className={tab === 'overview' ? '' : 'hidden'}>
            <OverviewPanel member={member} isMe={isMe} upcoming={upcoming} done={done} away={futureAbsences} loading={!data.data} />
          </TabPanel>
          <TabPanel idPrefix="member" id="schedule" className={tab === 'schedule' ? '' : 'hidden'}>
            <SchedulePanel member={member} isMe={isMe} away={futureAbsences} />
          </TabPanel>
          <TabPanel idPrefix="member" id="tasks" className={tab === 'tasks' ? '' : 'hidden'}>
            <TasksPanel upcoming={upcoming} done={done} />
          </TabPanel>
          <TabPanel idPrefix="member" id="access" className={tab === 'access' ? '' : 'hidden'}>
            <AccessPanel member={member} canManage={canManage} isLead={isLead} error={update.error} pending={update.pending} onChange={setAccess} />
          </TabPanel>
        </>
      )}

      {canEdit && (
        <MemberEditDialog
          member={member}
          isMe={isMe}
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
        title={`Remove ${member.name} from the family?`}
        description={`Their ${upcoming.length} open shared task${upcoming.length === 1 ? '' : 's'} will need someone, so another person can pick ${upcoming.length === 1 ? 'it' : 'them'} up. Their private tasks and health notes go with them.`}
        confirmLabel="Remove"
      />
    </>
  );
}
