import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Copy, Download, HeartHandshake, KeyRound, MapPin, Pencil, UserPlus, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { downloadFile, slugify, toCsv } from '@/lib/download';
import { ROLES, SKILLS, WEEKDAY_LABELS } from '@/constants/labels';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { InviteMemberDialog } from './InviteMemberDialog';
import { FamilyDetailsDialog } from './FamilyDetailsDialog';
import type { FamilyMember } from '@/types/domain';

function availabilitySummary(m: FamilyMember): string {
  const days = WEEKDAY_LABELS.filter((_, i) => m.availability.days[i]);
  if (!days.length) return 'No days set';
  if (days.length === 7) return 'Every day';
  if (days.join() === 'Mon,Tue,Wed,Thu,Fri') return 'Weekdays';
  if (days.join() === 'Sat,Sun') return 'Weekends';
  return days.join(', ');
}

export default function FamilyPage() {
  useDocumentTitle('Family circle');
  const { family, members, me, isLead, refresh, status } = useFamily();
  const { toast } = useToast();
  const tasks = useAsync(() => taskService.listTasks(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (status === 'error') return <ErrorState headingLevel="h1" message="We couldnΓÇÖt load your circle." onRetry={refresh} />;
  if (!family) return <PageSkeleton />;

  const scheduled = (tasks.data ?? []).filter((t) => t.status === 'scheduled');
  const openFor = (id: string) => scheduled.filter((t) => t.assigneeId === id).length;
  const active = members.filter((m) => m.status === 'active');
  const invited = members.filter((m) => m.status === 'invited');
  const unassigned = scheduled.filter((t) => !t.assigneeId).length;
  const recipient = family.recipient;
  const age = recipient.birthYear ? new Date().getFullYear() - recipient.birthYear : undefined;

  const exportRoster = () => {
    const rows = [
      ['Name', 'Relationship', 'Role', 'Status', 'Email', 'Phone', 'Focus', 'Skills', 'Available'],
      ...members.map((m) => [m.name, m.relation, ROLES[m.role].label, m.status, m.email, m.phone ?? '', m.focus, m.skills.map((s) => SKILLS[s]).join('; '), availabilitySummary(m)]),
    ];
    downloadFile(`${slugify(family.name) || 'family'}-roster.csv`, toCsv(rows), 'text/csv');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      toast({ title: 'Family code copied', description: family.inviteCode });
    } catch {
      toast({ tone: 'error', title: 'CouldnΓÇÖt copy', description: `Your code is ${family.inviteCode}.` });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={family.name}
        title="Family circle"
        description="WhoΓÇÖs helping, what theyΓÇÖre good at, and how the work is shared."
        actions={
          <>
            <Button variant="secondary" onClick={exportRoster} leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}>
              Export roster
            </Button>
            {isLead && (
              <Button onClick={() => setInviteOpen(true)} leftIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}>
                Invite member
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card tone="rose" as="section" aria-labelledby="recipient-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar name={recipient.name} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow flex items-center gap-1.5 text-rose-700">
                <HeartHandshake aria-hidden="true" className="h-3.5 w-3.5" /> Cared for by this circle
              </p>
              <h2 id="recipient-heading" className="mt-1 font-display text-2xl">
                {recipient.name}
              </h2>
              <p className="text-sm text-ink-muted">
                {[recipient.relation, age ? `${age} years` : null, family.careFocus].filter(Boolean).join(' ┬╖ ')}
              </p>
              {recipient.careNotes ? (
                <p className="mt-3 max-w-prose text-[15px] text-ink">{recipient.careNotes}</p>
              ) : (
                isLead && (
                  <button type="button" onClick={() => setDetailsOpen(true)} className="mt-3 text-sm font-semibold text-rose-700 underline-offset-2 hover:underline">
                    Add routines & preferences helpers should know
                  </button>
                )
              )}
              {family.location && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin aria-hidden="true" className="h-4 w-4" /> {family.location}
                </p>
              )}
            </div>
            {isLead && (
              <Button variant="secondary" size="sm" onClick={() => setDetailsOpen(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                Edit details
              </Button>
            )}
          </div>
        </Card>

        <Card as="aside" aria-labelledby="code-heading">
          <p className="eyebrow flex items-center gap-1.5">
            <KeyRound aria-hidden="true" className="h-3.5 w-3.5" /> Family code
          </p>
          <h2 id="code-heading" className="sr-only">
            Family code
          </h2>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-wider text-ink">{family.inviteCode}</p>
          <p className="mt-1 text-sm text-ink-muted">People you invite use this code to join.</p>
          <Button variant="soft" size="sm" className="mt-3" onClick={copyCode} leftIcon={<Copy aria-hidden="true" className="h-4 w-4" />}>
            Copy code
          </Button>
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <div>
              <dt className="text-xs text-ink-subtle">Active</dt>
              <dd className="font-display text-xl">{active.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Invited</dt>
              <dd className="font-display text-xl">{invited.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Unassigned</dt>
              <dd className="font-display text-xl">{tasks.data ? unassigned : 'ΓÇô'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card as="section" aria-labelledby="members-heading">
        <CardHeader title={<span id="members-heading">Members</span>} description="Open tasks count everything scheduled that hasnΓÇÖt happened yet." icon={<Users aria-hidden="true" className="h-5 w-5" />} />
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                to={`/family/${m.id}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface-muted p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/60"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {m.name}
                      {m.id === me?.id && <span className="font-normal text-ink-subtle"> (you)</span>}
                    </p>
                    {m.relation && <p className="truncate text-sm text-ink-muted">{m.relation}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={m.role === 'lead' ? 'primary' : m.role === 'observer' ? 'neutral' : 'mint'}>{ROLES[m.role].label}</Badge>
                      {m.status === 'invited' && (
                        <Badge tone="amber" dot>
                          Invited
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </div>
                {m.focus && <p className="mt-3 text-sm text-ink">{m.focus}</p>}
                {m.skills.length > 0 && <p className="mt-1 text-xs text-ink-subtle">{m.skills.map((s) => SKILLS[s]).join(' ┬╖ ')}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-ink-muted">
                  <span>{availabilitySummary(m)}</span>
                  {m.role !== 'observer' && <span>{tasks.data ? `${openFor(m.id)} open task${openFor(m.id) === 1 ? '' : 's'}` : ''}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {members.length <= 1 ? (
          <EmptyState
            compact
            className="mt-4"
            icon={<UserPlus aria-hidden="true" />}
            title="ItΓÇÖs just you so far"
            description="Invite family, friends or neighbours so Hearth can share the work fairly."
            action={isLead ? <Button onClick={() => setInviteOpen(true)}>Invite someone</Button> : undefined}
          />
        ) : null}
      </Card>

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(m) => {
          toast({ title: 'Invitation recorded', description: `${m.name} is now listed as invited.` });
          void refresh();
        }}
      />
      <FamilyDetailsDialog family={family} open={detailsOpen} onClose={() => setDetailsOpen(false)} onSaved={() => { toast({ title: 'Family details saved' }); void refresh(); }} />
    </>
  );
}
