import { useEffect, useState, type FormEvent } from 'react';
import { familyService } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { maxLength, required, validate } from '@/lib/validation';
import { Button, Dialog, FormError, FormField, Input } from '@/components/ui';
import type { Family } from '@/types/domain';

type Errors = Partial<Record<'name' | 'location', string>>;

/** Edit the family’s name and location. Organisers only. */
export function FamilyDetailsDialog({ family, open, onClose, onSaved }: { family: Family; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(family.name);
  const [location, setLocation] = useState(family.location);
  const [errors, setErrors] = useState<Errors>({});
  const save = useMutation(familyService.updateFamily);

  useEffect(() => {
    if (open) {
      setName(family.name);
      setLocation(family.location);
      setErrors({});
    }
  }, [open, family]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      name: validate(name, required('Family name'), maxLength('Family name', 60)),
      location: validate(location, maxLength('City or area', 80)),
    };
    setErrors(next);
    if (next.name || next.location) return;
    const saved = await save.run({ name: name.trim(), location: location.trim() });
    if (saved) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <form id="family-details-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={save.error} />
        <FormField label="Family name" required error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField label="City or area" hint="Optional" error={errors.location}>
          {(p) => <Input {...p} autoComplete="address-level2" value={location} onChange={(e) => setLocation(e.target.value)} />}
        </FormField>
      </form>
    </Dialog>
  );
}
