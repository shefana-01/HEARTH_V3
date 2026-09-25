import { useFamily } from '@/app/FamilyProvider';
import { RadioCards, ToggleChip } from '@/components/ui';
import type { Sharing } from './documentText';

/** Who can open a document: the family, only me, or chosen people. */
export function AccessPicker({
  sharing,
  onSharing,
  chosen,
  onChosen,
  error,
}: {
  sharing: Sharing;
  onSharing: (sharing: Sharing) => void;
  chosen: string[];
  onChosen: (ids: string[]) => void;
  error?: string;
}) {
  const { members, me } = useFamily();
  const others = members.filter((m) => m.id !== me?.id && m.status === 'active');
  return (
    <div className="space-y-3">
      <RadioCards<Sharing>
        name="access"
        legend="Who can open it?"
        columns={3}
        value={sharing}
        onChange={onSharing}
        error={sharing === 'chosen' ? error : undefined}
        options={[
          { value: 'family', label: 'My family', description: 'Everyone with document access.' },
          { value: 'me', label: 'Only me', description: 'No one else can open it.' },
          { value: 'chosen', label: 'Chosen people', description: 'You pick who else can open it.' },
        ]}
      />
      {sharing === 'chosen' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="People who can open it">
          {others.map((m) => (
            <ToggleChip key={m.id} pressed={chosen.includes(m.id)} onClick={() => onChosen(chosen.includes(m.id) ? chosen.filter((id) => id !== m.id) : [...chosen, m.id])}>
              {m.name}
            </ToggleChip>
          ))}
          <p className="w-full text-xs text-ink-subtle">You always keep access to documents you upload.</p>
        </div>
      )}
    </div>
  );
}
