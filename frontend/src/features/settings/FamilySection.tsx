import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, HeartHandshake, KeyRound, ShieldCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { familyService } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { listNames } from '@/lib/format';
import { maxLength, required, validate } from '@/lib/validation';
import { ROLES } from '@/constants/labels';
import { Avatar, Badge, Button, Card, CardHeader, FormError, FormField, Input, PageSkeleton, useToast } from '@/components/ui';
import type { Family, FamilyMember } from '@/types/domain';

type Errors = Partial<Record<'name' | 'location', string>>;

function FamilyDetailsCard({ family }: { family: Family }) {
  const { toast } = useToast();
  const { isLead, refresh } = useFamily();
  const [draft, setDraft] = useState({ name: family.name, location: family.location });
  const [errors, setErrors] = useState<Errors>({});
  const save = useMutation(familyService.updateFamily);
  const dirty = draft.name !== family.name || draft.location !== family.location;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      name: validate(draft.name, required('Family name'), maxLength('Family name', 60)),
      location: validate(draft.location, maxLength('Location', 80)),
    };
    setErrors(next);
    if (next.name || next.location) return;
    if (await save.run({ name: draft.name.trim(), location: draft.location.trim() })) {
      await refresh();
      toast({ title: 'Family details saved' });
    }
  };

  return (
    <Card as="section" aria-labelledby="family-settings-heading">
      <CardHeader title={<span id="family-settings-heading">Family details</span>} icon={<HeartHandshake aria-hidden="true" className="h-5 w-5" />} />
      {isLead ? (
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormError message={save.error} />
          <FormField label="Family name" required error={errors.name}>
            {(p) => <Input {...p} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
          </FormField>
          <FormField label="City or area" hint="Optional" error={errors.location}>
            {(p) => <Input {...p} value={draft.location} autoComplete="address-level2" onChange={(e) => setDraft({ ...draft, location: e.target.value })} />}
          </FormField>
          <div className="flex justify-end border-t border-line pt-4">
            <Button type="submit" loading={save.pending} disabled={!dirty}>
              Save details
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="divide-y divide-line">
            {[
              ['Family name', family.name],
              ['City or area', family.location || '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm text-ink-subtle">{k}</dt>
                <dd className="text-sm font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-subtle">Only the organiser can change these details.</p>
        </>
      )}
    </Card>
  );
}

function InviteCodeCard({ code }: { code: string }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: 'Code copied' });
    } catch {
      toast({ tone: 'error', title: 'Couldn’t copy the code', description: 'Select it and copy it by hand.' });
    }
  };
  return (
    <Card as="section" aria-labelledby="invite-code-heading">
      <CardHeader
        title={<span id="invite-code-heading">Invitation code</span>}
        description="Share it with people you have invited, so they can join your family."
        icon={<KeyRound aria-hidden="true" className="h-5 w-5" />}
      />
      <div className="flex flex-wrap items-center gap-3">
        <p className="rounded-xl bg-surface-muted px-4 py-2.5 font-mono text-lg font-semibold tracking-wide text-ink">{code}</p>
        <Button variant="secondary" size="sm" leftIcon={<Copy aria-hidden="true" className="h-4 w-4" />} onClick={copy}>
          Copy code
        </Button>
      </div>
    </Card>
  );
}

const ACCESS_LABELS: Record<keyof FamilyMember['access'], string> = { schedule: 'Schedule', medical: 'Health notes', documents: 'Documents' };

/** What a member may open beyond their own things. */
function accessSummary(member: FamilyMember): string {
  if (member.role === 'lead') return 'Everything';
  const allowed = (Object.keys(ACCESS_LABELS) as (keyof FamilyMember['access'])[]).filter((key) => member.access[key]).map((key) => ACCESS_LABELS[key]);
  return allowed.length ? listNames(allowed) : 'Shared tasks and chat only';
}

export function FamilySection() {
  const { family, members } = useFamily();
  if (!family) return <PageSkeleton />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <FamilyDetailsCard family={family} />
        <InviteCodeCard code={family.inviteCode} />
      </div>
      <Card as="section" aria-labelledby="permissions-heading">
        <CardHeader
          title={<span id="permissions-heading">Who can see what</span>}
          icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
          description="Everyone sees shared tasks and the family chat. The organiser sets the rest on each person’s page."
        />
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.id}>
              <Link to={`/family/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted">
                <Avatar name={m.name} src={m.photo} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs font-normal text-ink-subtle">{ROLES[m.role].label}</span>
                    {m.status === 'invited' && <Badge tone="amber">Invited</Badge>}
                  </span>
                  <span className="block text-[0.8125rem] text-ink-muted">Can see: {accessSummary(m)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
