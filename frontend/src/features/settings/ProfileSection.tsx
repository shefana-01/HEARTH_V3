import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Mail, Phone, User, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { familyService } from '@/services/family/familyService';
import { isDemoMode } from '@/services/config';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { squarePhoto } from '@/lib/image';
import { email, maxLength, phone, required, validate } from '@/lib/validation';
import { ROLES } from '@/constants/labels';
import { Avatar, Button, ButtonLink, Card, CardHeader, ErrorState, FormError, FormField, Input, PageSkeleton, Textarea, useToast } from '@/components/ui';
import type { Account } from '@/types/domain';

const ABOUT_MAX = 140;

interface ProfileDraft {
  name: string;
  email: string;
  phone: string;
  about: string;
}
type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;
const toDraft = (a: Account): ProfileDraft => ({ name: a.name, email: a.email, phone: a.phone ?? '', about: a.about });

export function ProfileSection() {
  const { toast } = useToast();
  const { refreshSession } = useAuth();
  const { me, family, refresh } = useFamily();
  const account = useAsync(() => familyService.getAccount(), []);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const save = useMutation(familyService.updateAccount);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (account.data && !draft) setDraft(toDraft(account.data));
  }, [account.data, draft]);

  if (account.status === 'error') return <ErrorState message={account.error?.message} onRetry={account.reload} />;
  if (!account.data || !draft) return <PageSkeleton />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(account.data));
  const set = (patch: Partial<ProfileDraft>) => setDraft({ ...draft, ...patch });

  const savePhoto = async (photo: string | undefined) => {
    const saved = await save.run({ photo });
    if (saved) {
      account.setData(saved);
      await Promise.all([refresh(), refreshSession()]);
      toast({ title: photo ? 'Profile photo updated' : 'Profile photo removed' });
    }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await savePhoto(await squarePhoto(file));
    } catch (err) {
      toast({ tone: 'error', title: 'Couldn’t use that photo', description: err instanceof Error ? err.message : undefined });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: ProfileErrors = {
      name: validate(draft.name, required('Full name'), maxLength('Full name', 80)),
      email: validate(draft.email, required('Email'), email),
      phone: validate(draft.phone, phone),
      about: validate(draft.about, maxLength('About', ABOUT_MAX)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const saved = await save.run({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() || undefined, about: draft.about.trim() });
    if (saved) {
      account.setData(saved);
      setDraft(toDraft(saved));
      await Promise.all([refresh(), refreshSession()]);
      toast({ title: 'Profile saved' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card as="section" aria-labelledby="profile-heading">
        <CardHeader title={<span id="profile-heading">Personal details</span>} description="How you appear to your family." icon={<User aria-hidden="true" className="h-5 w-5" />} />
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormError message={save.error} />
          <div className="flex items-center gap-4">
            <Avatar name={draft.name || '?'} src={account.data.photo} size="xl" />
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" leftIcon={<Camera aria-hidden="true" className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={save.pending}>
                  {account.data.photo ? 'Change photo' : 'Add photo'}
                </Button>
                {account.data.photo && (
                  <Button variant="ghost" size="sm" onClick={() => savePhoto(undefined)} disabled={save.pending}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-subtle">JPG, PNG or WebP, up to 5 MB.{isDemoMode && ' In the demo, it is kept on this device.'}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" required error={errors.name}>
              {(p) => <Input {...p} autoComplete="name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
            </FormField>
            <FormField label="Phone" hint="Optional" error={errors.phone}>
              {(p) => <Input {...p} type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />}
            </FormField>
          </div>
          <FormField label="Email" required error={errors.email} hint="Used to sign in.">
            {(p) => <Input {...p} type="email" autoComplete="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />}
          </FormField>
          <FormField label="About you" hint="A line your family will see on your profile." error={errors.about} aside={`${draft.about.length}/${ABOUT_MAX}`}>
            {(p) => <Textarea {...p} rows={3} maxLength={ABOUT_MAX + 20} value={draft.about} onChange={(e) => set({ about: e.target.value })} />}
          </FormField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                setDraft(toDraft(account.data!));
                setErrors({});
              }}
            >
              Discard
            </Button>
            <Button type="submit" loading={save.pending} disabled={!dirty}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>

      <Card as="aside" aria-label="Profile preview" tone="primary">
        <p className="eyebrow mb-3">Preview</p>
        <div className="flex items-center gap-3">
          <Avatar name={draft.name || '?'} src={account.data.photo} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{draft.name || 'Your name'}</p>
            <p className="text-sm text-ink-muted">{me ? ROLES[me.role].label : ''}</p>
          </div>
        </div>
        {draft.about && <p className="mt-3 text-sm italic text-ink">“{draft.about}”</p>}
        <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
          <li className="flex min-w-0 items-center gap-2">
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{draft.email || '—'}</span>
          </li>
          {draft.phone && (
            <li className="flex items-center gap-2">
              <Phone aria-hidden="true" className="h-4 w-4" /> {draft.phone}
            </li>
          )}
          {family && (
            <li className="flex items-center gap-2">
              <Users aria-hidden="true" className="h-4 w-4" /> {family.name}
            </li>
          )}
        </ul>
        {me && (
          <ButtonLink to={`/family/${me.id}`} variant="secondary" size="sm" className="mt-4">
            Skills & availability
          </ButtonLink>
        )}
      </Card>
    </div>
  );
}
