import { useFamily } from '@/app/FamilyProvider';
import { activeStatus } from '@/components/domain/People';
import { Avatar } from '@/components/ui';

/** Who is in the family chat, with their status line, so you can see who is around. */
export function PresenceStrip() {
  const { members, me } = useFamily();
  const active = members.filter((m) => m.status === 'active');

  return (
    <ul aria-label="People in the family chat" className="scrollbar-thin -mx-1 mb-3 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1">
      {active.map((m) => {
        const status = activeStatus(m);
        return (
          <li key={m.id} className="flex max-w-[14rem] shrink-0 items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 ring-1 ring-inset ring-line">
            <Avatar name={m.name} src={m.photo} size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                {m.name.split(' ')[0]}
                {m.id === me?.id && <span className="font-normal text-ink-subtle"> (me)</span>}
              </span>
              {status && <span className="block truncate text-xs text-ink-muted">{status}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
