import { Lock, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { Badge, FormField, RadioCards, Select } from '@/components/ui';
import type { FamilyMember, Visibility } from '@/types/domain';

/**
 * Pick who something is for or about: any active member or anyone the family
 * looks after. `emptyLabel` adds a "nobody in particular" choice (value '').
 */
export function PersonSelect({
  label,
  value,
  onChange,
  emptyLabel,
  hint,
  error,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (personId: string) => void;
  emptyLabel?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const { people, me } = useFamily();
  const members = people.filter((p) => p.kind === 'member');
  const dependants = people.filter((p) => p.kind === 'dependant');
  return (
    <FormField label={label} hint={hint} error={error} required={required} className={className}>
      {(control) => (
        <Select {...control} value={value} onChange={(e) => onChange(e.target.value)}>
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          <optgroup label="Family members">
            {members.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === me?.id ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </optgroup>
          {dependants.length > 0 && (
            <optgroup label="People we look after">
              {dependants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.relation ? `${p.name} (${p.relation})` : p.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      )}
    </FormField>
  );
}

/** Shared with the family, or just for me. Used by tasks and appointments. */
export function VisibilityField({ name, value, onChange, what }: { name: string; value: Visibility; onChange: (value: Visibility) => void; what: 'task' | 'appointment' }) {
  return (
    <RadioCards<Visibility>
      name={name}
      legend="Who can see this?"
      columns={2}
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'family',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="h-4 w-4" /> My family
            </span>
          ),
          description: what === 'task' ? 'Everyone sees it and it can be handed over if you can’t do it.' : 'Everyone sees it, so they can plan around it or come along.',
        },
        {
          value: 'private',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Lock aria-hidden="true" className="h-4 w-4" /> Only me
            </span>
          ),
          description: 'Your family only sees that you are busy at that time.',
        },
      ]}
    />
  );
}

export function PrivateBadge({ className }: { className?: string }) {
  return (
    <Badge tone="neutral" className={className}>
      <Lock aria-hidden="true" className="h-3 w-3" />
      Private
    </Badge>
  );
}

/** A member's status line, or `null` once it has run out. */
// eslint-disable-next-line react-refresh/only-export-components
export function activeStatus(member: Pick<FamilyMember, 'statusNote'> | undefined, now: number = Date.now()): string | null {
  const note = member?.statusNote;
  if (!note || (note.until && new Date(note.until).getTime() < now)) return null;
  return note.text;
}
