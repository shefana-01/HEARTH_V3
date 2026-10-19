import { Link } from 'react-router-dom';
import { ChevronRight, UserPlus } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { useAsync } from '@/hooks/useAsync';
import { plural } from '@/lib/format';
import { ROLES } from '@/constants/labels';
import { activeStatus } from '@/components/domain/People';
import { Avatar, Badge, Button, EmptyState, SectionHeader } from '@/components/ui';
import type { FamilyMember } from '@/types/domain';

function PersonCard({ member, isMe, openTasks }: { member: FamilyMember; isMe: boolean; openTasks: number | undefined }) {
  const status = member.status === 'active' ? activeStatus(member) : null;
  return (
    <Link
      to={`/family/${member.id}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary-200 hover:bg-primary-50/60"
    >
      <div className="flex items-start gap-3">
        <Avatar name={member.name} src={member.photo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {member.name}
            {isMe && <span className="font-normal text-ink-subtle"> (me)</span>}
          </p>
          {member.relation && <p className="truncate text-sm text-ink-muted">{member.relation}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={member.role === 'lead' ? 'primary' : member.role === 'observer' ? 'neutral' : 'mint'}>{ROLES[member.role].label}</Badge>
            {member.status === 'invited' && (
              <Badge tone="amber" dot>
                Invited
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
      </div>
      {status && <p className="mt-3 text-sm italic text-ink-muted">“{status}”</p>}
      {openTasks !== undefined && <p className="mt-auto pt-3 text-xs text-ink-muted">{plural(openTasks, 'open task')}</p>}
    </Link>
  );
}

/** Everyone in the family, with their status line and how many shared tasks they have open. */
export function PeopleSection({ onInvite }: { onInvite: () => void }) {
  const { members, me, isLead } = useFamily();
  const tasks = useAsync(() => taskService.listTasks(), []);
  const open = (tasks.data ?? []).filter((t) => t.status === 'scheduled' && t.visibility === 'family');
  const openFor = (member: FamilyMember) => (tasks.data && member.status === 'active' && member.role !== 'observer' ? open.filter((t) => t.assigneeId === member.id).length : undefined);

  return (
    <section aria-labelledby="people-heading">
      <SectionHeader id="people-heading" title="People" count={members.length} />
      <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {members.map((m) => (
          <li key={m.id}>
            <PersonCard member={m} isMe={m.id === me?.id} openTasks={openFor(m)} />
          </li>
        ))}
      </ul>
      {members.length <= 1 && (
        <EmptyState
          compact
          className="mt-4"
          icon={<UserPlus aria-hidden="true" />}
          title="It’s just you so far"
          description="Invite family, friends or neighbours so Hearth can share the work fairly."
          action={
            isLead ? (
              <Button className="h-11" onClick={onInvite}>
                Invite someone
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
