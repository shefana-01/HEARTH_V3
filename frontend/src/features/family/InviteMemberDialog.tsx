import { useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import { familyService, type InviteInput } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { email, required, validate } from '@/lib/validation';
import { RELATION_SUGGESTIONS, ROLES } from '@/constants/labels';
import { isDemoMode } from '@/services/config';
import { Button, Callout, Dialog, FormError, FormField, Input, RadioCards } from '@/components/ui';
import type { FamilyMember } from '@/types/domain';

type Errors = Partial<Record<'name' | 'email', string>>;
const EMPTY: InviteInput = { name: '', email: '', relation: '', role: 'contributor' };

/** Invite a new person to the family. Organisers only. */
export function InviteMemberDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (member: FamilyMember) => void }) {
  const [form, setForm] = useState<InviteInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const invite = useMutation(familyService.inviteMember);

  const close = () => {
    setForm(EMPTY);
    setErrors({});
    onClose();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      name: validate(form.name, required('Name')),
      email: validate(form.email, required('Email'), email),
    };
    setErrors(next);
    if (next.name || next.email) return;
    const member = await invite.run(form);
    if (member) {
      onInvited(member);
      close();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite someone to your family"
      description="They’ll show as invited until they join with your family code."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={invite.pending}>
            Send invitation
          </Button>
        </>
      }
    >
      <form id="invite-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={invite.error} />
        <FormField label="Full name" required error={errors.name}>
          {(p) => <Input {...p} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </FormField>
        <FormField label="Email" required error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </FormField>
        <FormField label="Relationship" hint="How they’re related to you, for example Daughter or Neighbour.">
          {(p) => (
            <>
              <Input {...p} list="invite-relations" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
              <datalist id="invite-relations">
                {RELATION_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
        <RadioCards
          name="invite-role"
          legend="How will they take part?"
          columns={2}
          value={form.role}
          onChange={(role) => setForm({ ...form, role })}
          options={(['contributor', 'observer'] as const).map((r) => ({ value: r, label: ROLES[r].label, description: ROLES[r].description }))}
        />
        {isDemoMode && (
          <Callout tone="neutral" icon={<Info aria-hidden="true" />}>
            In the demo the invitation is only saved here. No email is sent.
          </Callout>
        )}
      </form>
    </Dialog>
  );
}
