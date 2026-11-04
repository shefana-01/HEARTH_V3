import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { medicationService } from '@/services/care/medicationService';
import { toDateInputValue } from '@/lib/dates';
import { WEEKDAY_LABELS } from '@/constants/labels';
import { Button, Checkbox, Dialog, FormError, FormField, IconButton, Input, Select, ToggleChip, useToast } from '@/components/ui';
import type { Medication, MedicationInput } from '@/types/domain';

const EMPTY = (personId: string): MedicationInput => ({
  personId,
  name: '',
  dose: '',
  instructions: '',
  times: ['08:00'],
  days: [true, true, true, true, true, true, true],
  startDate: toDateInputValue(),
  endDate: undefined,
  carerId: undefined,
  reminders: true,
  active: true,
});

/** Add or change a medicine schedule. */
export function MedicationDialog({ open, onClose, existing, onSaved, defaultPersonId }: { open: boolean; onClose: () => void; existing?: Medication; onSaved: () => void; defaultPersonId?: string }) {
  const { people, members, me, canSeeMedical, family } = useFamily();
  const { toast } = useToast();
  const isObserver = me?.role === 'observer';
  const editable = useMemo(() => people.filter((p) => p.id === me?.id || (p.kind === 'dependant' && canSeeMedical && !isObserver)), [people, me?.id, canSeeMedical, isObserver]);
  const carers = members.filter((m) => m.status === 'active' && m.role !== 'observer');
  const [form, setForm] = useState<MedicationInput>(EMPTY(defaultPersonId ?? me?.id ?? ''));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(existing ? { ...existing } : EMPTY(defaultPersonId ?? me?.id ?? ''));
  }, [open, existing, defaultPersonId, me?.id]);

  const set = <K extends keyof MedicationInput>(key: K, value: MedicationInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const isDependant = Boolean(family?.dependants.some((d) => d.id === form.personId));

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      if (existing) await medicationService.update(existing.id, form);
      else await medicationService.create(form);
      toast({ title: existing ? 'Medicine updated' : 'Medicine added', description: form.name });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The medicine couldn’t be saved.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      size="lg"
      title={existing ? 'Change medicine' : 'Add a medicine'}
      description="Hearth reminds and keeps track. It doesn’t give medical advice; follow the prescription."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={pending}>
            {existing ? 'Save changes' : 'Add medicine'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Who takes it" required className="sm:col-span-2">
          {(field) => (
            <Select {...field} value={form.personId} disabled={Boolean(existing)} onChange={(e) => set('personId', e.target.value)}>
              {editable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === me?.id ? `${p.name} (me)` : `${p.name}${p.relation ? ` · ${p.relation}` : ''}`}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Medicine" required>
          {(field) => <Input {...field} value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Amlodipine" />}
        </FormField>
        <FormField label="Dose" aside="Optional">
          {(field) => <Input {...field} value={form.dose} maxLength={60} onChange={(e) => set('dose', e.target.value)} placeholder="e.g. 1 tablet, 5 ml" />}
        </FormField>
        <FormField label="How to take it" aside="Optional" className="sm:col-span-2">
          {(field) => <Input {...field} value={form.instructions} maxLength={300} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. after breakfast, with water" />}
        </FormField>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Times of day</legend>
          <div className="flex flex-wrap items-center gap-2">
            {form.times.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <label className="sr-only" htmlFor={`med-time-${i}`}>
                  Time {i + 1}
                </label>
                <Input
                  id={`med-time-${i}`}
                  type="time"
                  className="w-32"
                  value={t}
                  onChange={(e) =>
                    set(
                      'times',
                      form.times.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
                {form.times.length > 1 && (
                  <IconButton
                    label={`Remove time ${i + 1}`}
                    size="sm"
                    onClick={() =>
                      set(
                        'times',
                        form.times.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                )}
              </span>
            ))}
            {form.times.length < 6 && (
              <Button size="sm" variant="ghost" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => set('times', [...form.times, '20:00'])}>
                Add a time
              </Button>
            )}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, i) => (
              <ToggleChip
                key={label}
                pressed={form.days[i]}
                onClick={() =>
                  set(
                    'days',
                    form.days.map((d, j) => (j === i ? !d : d)),
                  )
                }
              >
                {label}
              </ToggleChip>
            ))}
          </div>
        </fieldset>

        <FormField label="First day" required>
          {(field) => <Input {...field} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />}
        </FormField>
        <FormField label="Last day" aside="Leave empty if ongoing">
          {(field) => <Input {...field} type="date" min={form.startDate} value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || undefined)} />}
        </FormField>

        <FormField label="Who helps with it" aside={isDependant ? 'Gets the reminders' : 'Optional'} className="sm:col-span-2">
          {(field) => (
            <Select {...field} value={form.carerId ?? ''} onChange={(e) => set('carerId', e.target.value || undefined)}>
              <option value="">{isDependant ? 'Choose someone' : 'Nobody — I manage it myself'}</option>
              {carers
                .filter((m) => m.id !== form.personId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === me?.id ? `${m.name} (me)` : m.name}
                  </option>
                ))}
            </Select>
          )}
        </FormField>

        <div className="space-y-2 sm:col-span-2">
          <Checkbox checked={form.reminders} onChange={(e) => set('reminders', e.target.checked)} label="Remind at each time, and tell us if a dose isn’t marked within an hour" />
          {existing && <Checkbox checked={form.active} onChange={(e) => set('active', e.target.checked)} label="Taking it now (untick to pause without deleting)" />}
        </div>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </div>
    </Dialog>
  );
}
