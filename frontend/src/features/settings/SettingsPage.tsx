import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Camera, Database, Download, HeartHandshake, KeyRound, LogOut, Mail, Pencil, Phone, ShieldCheck, Trash2, User, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { authService } from '@/services/auth/authService';
import { isDemoMode } from '@/services/config';
import { familyService } from '@/services/family/familyService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { squarePhoto } from '@/lib/image';
import { email, maxLength, phone, required, validate } from '@/lib/validation';
import { ROLES } from '@/constants/labels';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  FormError,
  FormField,
  Input,
  PageHeader,
  PageSkeleton,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { FamilyDetailsDialog } from '@/features/family/FamilyDetailsDialog';
import type { Account } from '@/types/domain';

type Section = 'profile' | 'family' | 'security' | 'data';
const ABOUT_MAX = 140;

interface ProfileDraft {
  name: string;
  email: string;
  phone: string;
  about: string;
}
type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;
const toDraft = (a: Account): ProfileDraft => ({ name: a.name, email: a.email, phone: a.phone ?? '', about: a.about });

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const [section, setSection] = useState<Section>('profile');

  return (
    <>
      <PageHeader title="Settings" description="Your profile, your family’s details, and the data kept on this device." />
      <Tabs
        label="Settings sections"
        idPrefix="settings"
        value={section}
        onChange={setSection}
        className="mb-6"
        items={[
          { id: 'profile', label: 'Profile' },
          { id: 'family', label: 'Family' },
          { id: 'security', label: 'Sign-in & security' },
          { id: 'data', label: 'Data & privacy' },
        ]}
      />
      <TabPanel idPrefix="settings" id="profile" className={section === 'profile' ? '' : 'hidden'}>
        <ProfileSection />
      </TabPanel>
      <TabPanel idPrefix="settings" id="family" className={section === 'family' ? '' : 'hidden'}>
        <FamilySection />
      </TabPanel>
      <TabPanel idPrefix="settings" id="security" className={section === 'security' ? '' : 'hidden'}>
        <SecuritySection />
      </TabPanel>
      <TabPanel idPrefix="settings" id="data" className={section === 'data' ? '' : 'hidden'}>
        <DataSection />
      </TabPanel>
    </>
  );
}

/* ───────────── Profile ───────────── */

function ProfileSection() {
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
        <CardHeader title={<span id="profile-heading">Personal details</span>} description="How you appear to the rest of your circle." icon={<User aria-hidden="true" className="h-5 w-5" />} />
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
              <p className="mt-1.5 text-xs text-ink-subtle">JPG, PNG or WebP, up to 5 MB. Kept on this device in the preview.</p>
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
          <FormField label="Email" required error={errors.email} hint="Used to sign in on this device.">
            {(p) => <Input {...p} type="email" autoComplete="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />}
          </FormField>
          <FormField label="About you" hint="A line your circle will see on your profile." error={errors.about} aside={`${draft.about.length}/${ABOUT_MAX}`}>
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

/* ───────────── Family ───────────── */

function FamilySection() {
  const { toast } = useToast();
  const { family, members, isLead, refresh } = useFamily();
  const [open, setOpen] = useState(false);
  if (!family) return <PageSkeleton />;

  const rows: [string, string][] = [
    ['Family name', family.name],
    ['City or area', family.location || '—'],
    ['Care focus', family.careFocus],
    ['Caring for', [family.recipient.name, family.recipient.relation].filter(Boolean).join(' · ')],
    ['Members', `${members.filter((m) => m.status === 'active').length} active, ${members.filter((m) => m.status === 'invited').length} invited`],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="family-settings-heading">
        <CardHeader
          title={<span id="family-settings-heading">Family details</span>}
          icon={<HeartHandshake aria-hidden="true" className="h-5 w-5" />}
          action={
            isLead ? (
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                Edit
              </Button>
            ) : undefined
          }
        />
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-ink-subtle">{k}</dt>
              <dd className="text-sm font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {!isLead && <p className="mt-3 text-sm text-ink-subtle">Only the lead caregiver can change these details.</p>}
      </Card>
      <Card as="section" aria-labelledby="permissions-heading">
        <CardHeader
          title={<span id="permissions-heading">Who can see what</span>}
          icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
          description="Access is set per person on their profile."
        />
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id}>
              <Link to={`/family/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted">
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{m.name}</span>
                <span className="text-xs text-ink-subtle">{m.role === 'lead' ? 'Full access' : `${Object.values(m.access).filter(Boolean).length} of 3 areas`}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <FamilyDetailsDialog
        family={family}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          toast({ title: 'Family details saved' });
          void refresh();
        }}
      />
    </div>
  );
}

/* ───────────── Security ───────────── */

function SecuritySection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut, session, refreshSession } = useAuth();
  const account = useAsync(() => familyService.getAccount(), []);
  const savePref = useMutation(familyService.updateAccount);
  const hasPhone = Boolean(account.data?.phone);
  const toggleWhatsapp = async (on: boolean) => {
    const saved = await savePref.run({ whatsappAlerts: on });
    if (saved) {
      account.setData(saved);
      await refreshSession();
      toast({ title: on ? 'WhatsApp preference saved' : 'WhatsApp alerts turned off', description: on ? 'We’ll use it as soon as alerts are connected.' : undefined });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="password-heading">
        <CardHeader title={<span id="password-heading">Password</span>} icon={<KeyRound aria-hidden="true" className="h-5 w-5" />} />
        <Callout tone="neutral">
          {isDemoMode
            ? 'Password changes and two-step sign-in will be handled by Hearth’s secure sign-in service once it is connected. In this preview, accounts live only on this device.'
            : 'Changing your password and two-step sign-in aren’t available yet.'}
        </Callout>
        <Button className="mt-4" variant="secondary" disabled>
          Change password
        </Button>
      </Card>
      <Card as="section" aria-labelledby="session-heading">
        <CardHeader title={<span id="session-heading">This device</span>} icon={<LogOut aria-hidden="true" className="h-5 w-5" />} />
        <p className="text-sm text-ink-muted">
          Signed in as <span className="font-semibold text-ink">{session?.account.email}</span>.{session?.isSample && ' Signing out of the sample clears its data.'}
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          leftIcon={<LogOut aria-hidden="true" className="h-4 w-4" />}
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          Sign out
        </Button>
      </Card>
      <Card as="section" aria-labelledby="alerts-heading" className="lg:col-span-2">
        <CardHeader title={<span id="alerts-heading">Alerts & reminders</span>} icon={<Bell aria-hidden="true" className="h-5 w-5" />} />
        <p className="text-sm text-ink-muted">
          In-app notifications are on for everyone. Email and phone alerts need Hearth’s notification service and will be configurable here once it’s connected.{' '}
          <Link to="/notifications" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
            View notifications
          </Link>
        </p>
        <div className="mt-4 border-t border-line pt-4">
          <Switch
            checked={Boolean(account.data?.whatsappAlerts) && hasPhone}
            onChange={toggleWhatsapp}
            disabled={!account.data || !hasPhone || savePref.pending}
            label={
              <span className="flex flex-wrap items-center gap-2">
                WhatsApp alerts <Badge tone="amber">Coming soon</Badge>
              </span>
            }
            description={
              hasPhone
                ? `Get task changes and conflicts on ${account.data?.phone}. This saves your preference only — messages are sent once Hearth’s notification service is connected.`
                : 'Add a phone number in Profile first. WhatsApp alerts are sent to it.'
            }
          />
        </div>
      </Card>
    </div>
  );
}

/* ───────────── Data ───────────── */

function DataSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation(authService.deleteLocalData);
  const isSample = Boolean(session?.isSample);

  const onDelete = async () => {
    if (await remove.attempt()) {
      await signOut();
      navigate('/');
    } else {
      setConfirm(false);
      toast({ tone: 'error', title: 'Couldn’t remove the data', description: 'Please try again.' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="export-heading">
        <CardHeader title={<span id="export-heading">Download records</span>} icon={<Download aria-hidden="true" className="h-5 w-5" />} description="Spreadsheet exports you can keep or share." />
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/family" variant="secondary" size="sm">
            Family roster
          </ButtonLink>
          <ButtonLink to="/activity" variant="secondary" size="sm">
            Activity history
          </ButtonLink>
        </div>
      </Card>
      <Card as="section" aria-labelledby="storage-heading" tone={isSample ? 'amber' : 'default'}>
        <CardHeader title={<span id="storage-heading">Where your data lives</span>} icon={<Database aria-hidden="true" className="h-5 w-5" />} />
        {isSample ? (
          <p className="text-sm text-ink">
            You’re exploring <Badge tone="amber">Sample data</Badge>. Nothing here is real, and it’s cleared when you leave.
          </p>
        ) : isDemoMode ? (
          <p className="text-sm text-ink-muted">
            This preview keeps your account and family records in this browser only. They aren’t backed up or shared with other devices until Hearth’s servers are connected.
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Your account and family records are kept on Hearth’s servers, so your circle sees the same plan on every device. This browser only remembers that you’re signed in.
          </p>
        )}
        {isDemoMode && (
          <Button className="mt-4" variant={isSample ? 'secondary' : 'danger-ghost'} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setConfirm(true)}>
            {isSample ? 'Leave the sample' : 'Delete data on this device'}
          </Button>
        )}
      </Card>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={onDelete}
        loading={remove.pending}
        variant={isSample ? 'primary' : 'danger'}
        title={isSample ? 'Leave the sample family?' : 'Delete everything on this device?'}
        description={
          isSample
            ? 'The sample data will be cleared. You can create your own account next.'
            : 'Your account, family, tasks, appointments and documents will be permanently removed from this browser. This can’t be undone.'
        }
        confirmLabel={isSample ? 'Leave sample' : 'Delete everything'}
      />
    </div>
  );
}
