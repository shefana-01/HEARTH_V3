import { useEffect, useState, type FormEvent } from 'react';
import { familyService } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { maxLength, required, validate } from '@/lib/validation';
import { CARE_FOCUS_OPTIONS, RELATION_SUGGESTIONS } from '@/constants/labels';
import { Button, Dialog, FormError, FormField, Input, Select, Textarea } from '@/components/ui';
import type { Family } from '@/types/domain';

interface Draft {
  name: string;
  location: string;
  careFocus: string;
  recipientName: string;
  recipientRelation: string;
  birthYear: string;
  careNotes: string;
}
type Errors = Partial<Record<keyof Draft, string>>;

const toDraft = (f: Family): Draft => ({
  name: f.name,
  location: f.location,
  careFocus: f.careFocus,
  recipientName: f.recipient.name,
  recipientRelation: f.recipient.relation,
  birthYear: f.recipient.birthYear ? String(f.recipient.birthYear) : '',
  careNotes: f.recipient.careNotes,
});

/** Edit the family and care-recipient details. Leads only. */
export function FamilyDetailsDialog({ family, open, onClose, onSaved }: { family: Family; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(family));
  const [errors, setErrors] = useState<Errors>({});
  const save = useMutation(familyService.updateFamily);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(family));
      setErrors({});
    }
  }, [open, family]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const year = Number(draft.birthYear);
    const next: Errors = {
      name: validate(draft.name, required('Family name'), maxLength('Family name', 60)),
      recipientName: validate(draft.recipientName, required('Their name')),
      birthYear: draft.birthYear && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) ? 'Enter a four-digit year.' : undefined,
      careNotes: validate(draft.careNotes, maxLength('Care notes', 600)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const saved = await save.run({
      name: draft.name.trim(),
      location: draft.location.trim(),
      careFocus: draft.careFocus,
      recipient: {
        name: draft.recipientName.trim(),
        relation: draft.recipientRelation.trim(),
        birthYear: draft.birthYear ? year : undefined,
        careNotes: draft.careNotes.trim(),
      },
    });
    if (saved) {
      onSaved();
      onClose();
    }
  };

  const focusOptions = CARE_FOCUS_OPTIONS.includes(draft.careFocus) ? CARE_FOCUS_OPTIONS : [draft.careFocus, ...CARE_FOCUS_OPTIONS];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Family details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="family-details-form" loading={save.pending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="family-details-form" noValidate onSubmit={onSubmit} className="space-y-5">
        <FormError message={save.error} />
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="eyebrow mb-2">Your family</legend>
          <FormField label="Family name" required error={errors.name}>
            {(p) => <Input {...p} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
          </FormField>
          <FormField label="City or area">{(p) => <Input {...p} value={draft.location} onChange={(e) => set({ location: e.target.value })} />}</FormField>
          <FormField label="Care focus" className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={draft.careFocus} onChange={(e) => set({ careFocus: e.target.value })}>
                {focusOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            )}
          </FormField>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="eyebrow mb-2">The person you care for</legend>
          <FormField label="Name" required error={errors.recipientName}>
            {(p) => <Input {...p} value={draft.recipientName} onChange={(e) => set({ recipientName: e.target.value })} />}
          </FormField>
          <FormField label="Relationship to the family">
            {(p) => (
              <>
                <Input {...p} list="family-relations" value={draft.recipientRelation} onChange={(e) => set({ recipientRelation: e.target.value })} />
                <datalist id="family-relations">
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
          <FormField label="Care notes" hint="Routines, preferences or anything helpers should know." error={errors.careNotes} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={4} value={draft.careNotes} onChange={(e) => set({ careNotes: e.target.value })} />}
          </FormField>
        </fieldset>
      </form>
    </Dialog>
  );
}
