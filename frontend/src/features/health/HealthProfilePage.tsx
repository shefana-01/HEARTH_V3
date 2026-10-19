import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, UserRoundX, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { healthService } from '@/services/care/healthService';
import { HEALTH_CONDITIONS } from '@/constants/conditions';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ActionBar, Button, ButtonLink, Card, Checkbox, EmptyState, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, Switch, Textarea, ToggleChip, useToast } from '@/components/ui';
import { ProfileSummary } from './ProfileSummary';
import { ADVICE_LINE, NUTRITION_TAGS, errorStatus, isEmptyProfile, splitList } from './healthText';
import type { HealthGoal, HealthProfile, Person } from '@/types/domain';

interface Draft {
  conditions: string[];
  goals: HealthGoal[];
  avoid: string;
  preferences: string;
  notes: string;
  shared: boolean;
}

const newGoal = (): HealthGoal => ({ id: crypto.randomUUID(), title: '', target: '', tags: [] });

const isBlankGoal = (g: HealthGoal) => !g.title.trim() && !g.target.trim() && g.tags.length === 0;

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id}>
      <h2 id={id} className="font-display text-lg leading-snug">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function GoalEditor({ goal, error, onChange, onRemove }: { goal: HealthGoal; error: { title?: string; tags?: string }; onChange: (patch: Partial<HealthGoal>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Goal" required error={error.title}>
          {(p) => <Input {...p} value={goal.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="For example, less salt" />}
        </FormField>
        <FormField label="Target" aside="Optional">
          {(p) => <Input {...p} value={goal.target} onChange={(e) => onChange({ target: e.target.value })} placeholder="Under one teaspoon of salt a day" />}
        </FormField>
      </div>
      <p className="mb-2 mt-4 text-[0.8125rem] font-semibold text-ink">Food focus</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Food focus">
        {NUTRITION_TAGS.map((tag) => (
          <ToggleChip key={tag} pressed={goal.tags.includes(tag)} onClick={() => onChange({ tags: toggle(goal.tags, tag) })}>
            {NUTRITION_TAG_LABELS[tag]}
          </ToggleChip>
        ))}
      </div>
      {error.tags && <p className="mt-2 text-[0.8125rem] font-medium text-red-600">{error.tags}</p>}
      <Button variant="danger-ghost" size="sm" className="mt-3" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={onRemove}>
        Remove goal
      </Button>
    </div>
  );
}

function ProfileForm({ person, profile, isMine }: { person: Person; profile: HealthProfile; isMine: boolean }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>({
    conditions: profile.conditions,
    goals: profile.goals,
    avoid: profile.avoid.join(', '),
    preferences: profile.preferences.join(', '),
    notes: profile.notes,
    shared: profile.shared,
  });
  const [errors, setErrors] = useState<Record<string, { title?: string; tags?: string }>>({});
  const save = useMutation(healthService.saveProfile);

  const first = person.name.split(' ')[0];
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setGoal = (id: string, patch: Partial<HealthGoal>) =>
    set(
      'goals',
      draft.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const goals = draft.goals.filter((g) => !isBlankGoal(g));
    const next: Record<string, { title?: string; tags?: string }> = {};
    goals.forEach((g) => {
      const title = g.title.trim() ? undefined : 'Name this goal.';
      const tags = g.tags.length ? undefined : 'Choose at least one food focus.';
      if (title || tags) next[g.id] = { title, tags };
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    const saved = await save.run(person.id, {
      conditions: draft.conditions,
      goals,
      avoid: splitList(draft.avoid),
      preferences: splitList(draft.preferences),
      notes: draft.notes,
      shared: isMine ? draft.shared : true,
    });
    if (saved) {
      toast({ title: 'Health notes saved' });
      navigate('/health');
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
      <FormError message={save.error} />

      <Section
        id="conditions-heading"
        title={isMine ? 'Things a doctor has told you' : `Things a doctor has told ${first}`}
        description="Tick only what you have been told. Hearth does not work this out for you."
      >
        <fieldset aria-labelledby="conditions-heading" className="space-y-2">
          {HEALTH_CONDITIONS.map((condition) => (
            <div key={condition.id} className="rounded-xl border border-line p-3">
              <Checkbox
                checked={draft.conditions.includes(condition.id)}
                onChange={() => set('conditions', toggle(draft.conditions, condition.id))}
                label={condition.label}
                description={condition.summary}
              />
            </div>
          ))}
        </fieldset>
      </Section>

      <Section id="goals-heading" title={isMine ? 'My own goals' : `${first}’s own goals`} description="Optional. For example, something a doctor or dietitian suggested.">
        {draft.goals.map((goal) => (
          <GoalEditor
            key={goal.id}
            goal={goal}
            error={errors[goal.id] ?? {}}
            onChange={(patch) => setGoal(goal.id, patch)}
            onRemove={() =>
              set(
                'goals',
                draft.goals.filter((g) => g.id !== goal.id),
              )
            }
          />
        ))}
        <Button variant="soft" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => set('goals', [...draft.goals, newGoal()])}>
          Add a goal
        </Button>
      </Section>

      <Section id="foods-heading" title="Foods">
        <FormField label="Foods to leave out" hint="Hearth will not suggest these. Separate with commas.">
          {(p) => <Input {...p} value={draft.avoid} onChange={(e) => set('avoid', e.target.value)} placeholder="Grapefruit, stock cubes" />}
        </FormField>
        <FormField label={isMine ? 'Foods I like' : `Foods ${first} likes`} hint="Separate with commas.">
          {(p) => <Input {...p} value={draft.preferences} onChange={(e) => set('preferences', e.target.value)} placeholder="Lentil soup, rice, berries" />}
        </FormField>
      </Section>

      <Section id="notes-heading" title="Notes">
        <FormField label="Anything else worth remembering" aside="Optional" hint="For example, what the doctor said.">
          {(p) => <Textarea {...p} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />}
        </FormField>
      </Section>

      <Card as="section" aria-labelledby="sharing-heading">
        <h2 id="sharing-heading" className="sr-only">
          Who can see this
        </h2>
        {isMine ? (
          <Switch
            checked={draft.shared}
            onChange={(next) => set('shared', next)}
            label="Share with my family"
            description="Family members who can see health notes will see this, and your name can appear next to foods on the shopping list. Off by default."
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Users aria-hidden="true" className="h-4 w-4 shrink-0" /> Seen by the organiser and family members who can see health notes.
          </p>
        )}
      </Card>

      <p className="text-[0.8125rem] text-ink-subtle">{ADVICE_LINE}</p>

      <ActionBar className="flex-row lg:justify-end lg:border-t lg:border-line lg:pt-5">
        <Button variant="secondary" size="lg" onClick={() => navigate('/health')}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={save.pending}>
          Save
        </Button>
      </ActionBar>
    </form>
  );
}

export default function HealthProfilePage() {
  const { personId = '' } = useParams();
  const { people, me, canSeeMedical } = useFamily();
  const person = people.find((p) => p.id === personId);
  const isMine = personId === me?.id;
  const title = isMine ? 'My health notes' : person ? `${person.name}’s health notes` : 'Health notes';
  useDocumentTitle(title);
  const profile = useAsync(() => (person ? healthService.getProfile(personId) : Promise.resolve(undefined)), [personId, Boolean(person)]);

  if (!person) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<UserRoundX aria-hidden="true" />}
        title="We couldn’t find that person"
        description="They may have left the family, or the link may be old."
        action={<ButtonLink to="/health">Back to Health & food</ButtonLink>}
      />
    );
  }
  if (profile.status === 'loading' && !profile.data) return <PageSkeleton />;
  if (errorStatus(profile.error) === 403) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<UserRoundX aria-hidden="true" />}
        title={`${person.name.split(' ')[0]} keeps their health notes private.`}
        description="Family members choose whether to share their health notes."
        action={<ButtonLink to="/health">Back to Health & food</ButtonLink>}
      />
    );
  }
  if (profile.status === 'error' || !profile.data) return <ErrorState headingLevel="h1" message={profile.error?.message} onRetry={profile.reload} />;

  const editable = isMine || (person.kind === 'dependant' && canSeeMedical);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Health & food', to: '/health' }, { label: title }]}
        title={title}
        description={editable ? 'Hearth only uses what you tick and write here to suggest everyday foods.' : `What ${person.name.split(' ')[0]} has chosen to share with the family.`}
      />
      {editable ? (
        <ProfileForm key={personId} person={person} profile={profile.data} isMine={isMine} />
      ) : (
        <Card className="max-w-3xl space-y-4">
          {isEmptyProfile(profile.data) ? <p className="text-sm text-ink-muted">No health notes have been added.</p> : <ProfileSummary profile={profile.data} withNotes />}
          <p className="text-[0.8125rem] text-ink-subtle">{ADVICE_LINE}</p>
        </Card>
      )}
    </>
  );
}
