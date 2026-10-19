import { useEffect, useState, type FormEvent } from 'react';
import { familyService } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { maxLength, required, validate } from '@/lib/validation';
import { RELATION_SUGGESTIONS } from '@/constants/labels';
import { Button, Dialog, FormError, FormField, Input, Textarea } from '@/components/ui';
import type { Dependant, DependantInput } from '@/types/domain';

interface Draft {
  name: string;
  relation: string;
  birthYear: string;
  notes: string;
}
type Errors = Partial<Record<keyof Draft, string>>;

const toDraft = (d?: Dependant): Draft => ({ name: d?.name ?? '', relation: d?.relation ?? '', birthYear: d?.birthYear ? String(d.birthYear) : '', notes: d?.notes ?? '' });

/** Add someone the family looks after, or edit them when `dependant` is given. */
export function DependantDialog({ dependant, open, onClose, onSaved }: { dependant?: Dependant; open: boolean; onClose: () => void; onSaved: (saved: Dependant) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(dependant));
  const [errors, setErrors] = useState<Errors>({});
  const save = useMutation((input: DependantInput) => (dependant ? familyService.updateDependant(dependant.id, input) : familyService.addDependant(input)));

  useEffect(() => {
    if (open) {
      setDraft(toDraft(dependant));
      setErrors({});
    }
  }, [open, dependant]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const year = Number(draft.birthYear);
    const thisYear = new Date().getFullYear();
    const next: Errors = {
      name: validate(draft.name, required('Their name'), maxLength('Their name', 60)),
      birthYear: draft.birthYear && (!Number.isInteger(year) || year < 1900 || year > thisYear) ? `Enter a year between 1900 and ${thisYear}.` : undefined,
      notes: validate(draft.notes, maxLength('Notes', 400)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const saved = await save.run({ name: draft.name.trim(), relation: draft.relation.trim(), birthYear: draft.birthYear ? year : undefined, notes: draft.notes.trim() });
    if (saved) {
      onSaved(saved);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dependant ? `Edit ${dependant.name.split(' ')[0]}` : 'Add someone you look after'}
      description="Tasks, appointments and health notes can then be about them. They don’t need to use Hearth."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dependant-form" loading={save.pending}>
            {dependant ? 'Save changes' : 'Add them'}
          </Button>
        </>
      }
    >
      <form id="dependant-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={save.error} />
        <FormField label="Name" required error={errors.name}>
          {(p) => <Input {...p} autoComplete="off" value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Relationship" hint="For example Mother or Son.">
            {(p) => (
              <>
                <Input {...p} list="dependant-relations" value={draft.relation} onChange={(e) => set({ relation: e.target.value })} />
                <datalist id="dependant-relations">
                  {RELATION_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>
          <FormField label="Birth year" hint="Optional" error={errors.birthYear}>
            {(p) => <Input {...p} inputMode="numeric" maxLength={4} value={draft.birthYear} onChange={(e) => set({ birthYear: e.target.value.replace(/\D/g, '') })} />}
          </FormField>
        </div>
        <FormField label="Notes" hint="Routines or anything helpers should know. Optional." error={errors.notes}>
          {(p) => <Textarea {...p} rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />}
        </FormField>
      </form>
    </Dialog>
  );
}
