import { useEffect, useState, type FormEvent } from 'react';
import { familyService, type MemberUpdate } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { maxLength, phone, validate } from '@/lib/validation';
import { RELATION_SUGGESTIONS, ROLES, SKILLS } from '@/constants/labels';
import { Button, Dialog, FormError, FormField, Input, RadioCards, ToggleChip } from '@/components/ui';
import type { FamilyMember, MemberRole, Skill } from '@/types/domain';

interface Draft {
  relation: string;
  focus: string;
  phone: string;
  role: MemberRole;
  skills: Skill[];
}

const toDraft = (m: FamilyMember): Draft => ({ relation: m.relation, focus: m.focus, phone: m.phone ?? '', role: m.role, skills: [...m.skills] });

/** Edit a member’s profile. Everyone can edit their own; the organiser can also change anyone’s role. */
export function MemberEditDialog({
  member,
  isMe,
  allowRole,
  open,
  onClose,
  onSaved,
}: {
  member: FamilyMember;
  isMe: boolean;
  allowRole: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(member));
  const [errors, setErrors] = useState<Partial<Record<'phone' | 'focus', string>>>({});
  const save = useMutation((patch: MemberUpdate) => familyService.updateMember(member.id, patch));
  const first = member.name.split(' ')[0];

  useEffect(() => {
    if (open) {
      setDraft(toDraft(member));
      setErrors({});
    }
  }, [open, member]);

  const toggleSkill = (s: Skill) => setDraft((d) => ({ ...d, skills: d.skills.includes(s) ? d.skills.filter((x) => x !== s) : [...d.skills, s] }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { phone: validate(draft.phone, phone), focus: validate(draft.focus, maxLength('This line', 80)) };
    setErrors(next);
    if (next.phone || next.focus) return;
    const saved = await save.run({
      relation: draft.relation.trim(),
      focus: draft.focus.trim(),
      phone: draft.phone.trim() || undefined,
      skills: draft.skills,
      ...(allowRole ? { role: draft.role } : {}),
    });
    if (saved) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isMe ? 'Edit my profile' : `Edit ${first}’s profile`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-edit-form" loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <form id="member-edit-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Relationship">
            {(p) => (
              <>
                <Input {...p} list="member-relations" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} />
                <datalist id="member-relations">
                  {RELATION_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>
          <FormField label="Phone" hint="Optional" error={errors.phone}>
            {(p) => <Input {...p} type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />}
          </FormField>
        </div>
        <FormField label={isMe ? 'What I usually handle' : `What ${first} usually handles`} hint="For example groceries and weekend drives." error={errors.focus}>
          {(p) => <Input {...p} value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} />}
        </FormField>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{isMe ? 'What I can help with' : `What ${first} can help with`}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SKILLS) as Skill[]).map((s) => (
              <ToggleChip key={s} pressed={draft.skills.includes(s)} onClick={() => toggleSkill(s)}>
                {SKILLS[s]}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        {allowRole && (
          <RadioCards
            name="member-role"
            legend="How do they take part?"
            columns={2}
            value={draft.role}
            onChange={(role) => setDraft({ ...draft, role })}
            options={(['contributor', 'observer'] as const).map((r) => ({ value: r, label: ROLES[r].label, description: ROLES[r].description }))}
          />
        )}
      </form>
    </Dialog>
  );
}
