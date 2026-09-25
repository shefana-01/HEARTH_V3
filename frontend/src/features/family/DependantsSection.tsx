import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { familyService } from '@/services/family/familyService';
import { Avatar, Button, Card, ConfirmDialog, SectionHeader, useToast } from '@/components/ui';
import { DependantDialog } from './DependantDialog';
import type { Dependant } from '@/types/domain';

function ageOf(d: Dependant): string | null {
  if (!d.birthYear) return null;
  const age = new Date().getFullYear() - d.birthYear;
  return age < 1 ? 'Under a year old' : `${age} ${age === 1 ? 'year' : 'years'} old`;
}

/** The people the family looks after. Whoever may see health notes can add, edit and remove them. */
export function DependantsSection() {
  const { family, canSeeMedical, refresh } = useFamily();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Dependant | 'new' | null>(null);
  const [removing, setRemoving] = useState<Dependant | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const dependants = family?.dependants ?? [];

  const onRemove = async () => {
    if (!removing) return;
    setRemovePending(true);
    try {
      await familyService.removeDependant(removing.id);
      toast({ title: `${removing.name} was removed` });
      await refresh();
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t remove them', description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setRemovePending(false);
      setRemoving(null);
    }
  };

  return (
    <section aria-labelledby="dependants-heading">
      <SectionHeader
        id="dependants-heading"
        title="People we look after"
        count={dependants.length}
        aside={
          canSeeMedical &&
          dependants.length > 0 && (
            <Button variant="soft" className="h-11" onClick={() => setEditing('new')} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              Add someone
            </Button>
          )
        }
      />
      {dependants.length === 0 ? (
        <Card tone="muted" padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-prose text-sm text-ink-muted">Nobody yet. Add a child, a parent or anyone else your family looks after, so tasks, appointments and health notes can be about them.</p>
          {canSeeMedical && (
            <Button className="h-11 shrink-0" onClick={() => setEditing('new')} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              Add someone
            </Button>
          )}
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {dependants.map((d) => (
            <li key={d.id}>
              <Card padding="sm" className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={d.name} seed={d.id} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{d.name}</p>
                    <p className="text-sm text-ink-muted">{[d.relation, ageOf(d)].filter(Boolean).join(' · ') || 'Relationship not set'}</p>
                    {d.notes && <p className="mt-2 text-sm text-ink">{d.notes}</p>}
                  </div>
                </div>
                {canSeeMedical && (
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                    <Link to={`/health/${d.id}`} className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-primary-700 hover:underline">
                      <HeartPulse aria-hidden="true" className="h-4 w-4" /> Health notes
                    </Link>
                    <Button variant="ghost" size="sm" aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                      Edit
                    </Button>
                    <Button variant="danger-ghost" size="sm" aria-label={`Remove ${d.name}`} onClick={() => setRemoving(d)} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}>
                      Remove
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <DependantDialog
        dependant={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          toast({ title: editing === 'new' ? `${saved.name} was added` : 'Changes saved' });
          void refresh();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={onRemove}
        loading={removePending}
        variant="danger"
        title={`Remove ${removing?.name ?? 'this person'}?`}
        description="Their health notes are removed too. Tasks and documents about them stay, but are no longer linked to them."
        confirmLabel="Remove"
      />
    </section>
  );
}
