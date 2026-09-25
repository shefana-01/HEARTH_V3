import { Link } from 'react-router-dom';
import { ArrowRight, HeartPulse, Info, Lock, Salad, ShoppingBasket, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { healthService } from '@/services/care/healthService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton, SectionHeader } from '@/components/ui';
import { FoodSuggestionCard } from './FoodSuggestionCard';
import { ConditionChips, ProfileSummary } from './ProfileSummary';
import { ADVICE_LINE, isEmptyProfile } from './healthText';
import { useAddToList } from './useAddToList';
import type { HealthProfile } from '@/types/domain';

const SUGGESTION_LIMIT = 6;

function MyNotes({ profile, myId }: { profile: HealthProfile | undefined; myId: string }) {
  const editTo = `/health/${myId}`;
  if (!profile || isEmptyProfile(profile)) {
    return (
      <Card>
        <CardHeader title="My health notes" icon={<HeartPulse aria-hidden="true" className="h-5 w-5" />} />
        <EmptyState
          compact
          icon={<HeartPulse aria-hidden="true" />}
          tone="mint"
          title="Nothing here yet"
          description="Add what a doctor has told you and Hearth will suggest everyday foods."
          action={<ButtonLink to={editTo}>Add a health note</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="My health notes" icon={<HeartPulse aria-hidden="true" className="h-5 w-5" />} />
      <ProfileSummary profile={profile} />
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          {profile.shared ? <Users aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {profile.shared ? 'Shared with family members who can see health notes' : 'Only you can see this'}
        </p>
        <ButtonLink to={editTo} variant="secondary" className="min-h-11">
          Edit my notes
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function HealthPage() {
  useDocumentTitle('Health & food');
  const { family, me, canSeeMedical, personName } = useFamily();
  const data = useAsync(() => Promise.all([healthService.listProfiles(), healthService.getSuggestions()]), []);
  const list = useAddToList();

  const header = (
    <PageHeader
      title="Health & food"
      description="Keep a few health notes and Hearth will suggest everyday foods for the shopping list."
      actions={
        <ButtonLink to="/groceries" variant="secondary" leftIcon={<ShoppingBasket aria-hidden="true" className="h-4 w-4" />}>
          Shopping list
        </ButtonLink>
      }
    />
  );

  if (data.status === 'error') {
    return (
      <>
        {header}
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      </>
    );
  }
  if (!data.data) return <PageSkeleton />;

  const [profiles, suggestions] = data.data;
  const myId = me?.id ?? '';
  const mine = profiles.find((p) => p.personId === myId);
  const others = profiles.filter((p) => p.personId !== myId);
  const withoutNotes = canSeeMedical ? (family?.dependants ?? []).filter((d) => !profiles.some((p) => p.personId === d.id)) : [];
  const hasNotes = profiles.some((p) => !isEmptyProfile(p));
  const dependantRelation = (personId: string) => family?.dependants.find((d) => d.id === personId)?.relation;

  return (
    <>
      {header}
      <div className="space-y-8">
        <Callout tone="neutral" icon={<Info aria-hidden="true" />}>
          Hearth only uses what you tell it. It suggests foods, not treatment. {ADVICE_LINE}
        </Callout>

        <MyNotes profile={mine} myId={myId} />

        <section aria-labelledby="family-notes-heading">
          <SectionHeader id="family-notes-heading" title="Family" />
          {others.length === 0 && withoutNotes.length === 0 ? (
            <p className="text-sm text-ink-muted">Family members choose whether to share their health notes.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {others.map((p) => (
                <li key={p.personId}>
                  <Link to={`/health/${p.personId}`} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary-300">
                    <Avatar name={personName(p.personId)} seed={p.personId} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{personName(p.personId)}</span>
                      {dependantRelation(p.personId) && <span className="mb-2 block text-[0.8125rem] text-ink-subtle">{dependantRelation(p.personId)}</span>}
                      <ConditionChips ids={p.conditions} />
                    </span>
                    <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
              {withoutNotes.map((d) => (
                <li key={d.id}>
                  <Card padding="sm" className="flex h-full items-center gap-3">
                    <Avatar name={d.name} seed={d.id} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{d.name}</p>
                      <p className="text-[0.8125rem] text-ink-subtle">No notes yet</p>
                    </div>
                    <ButtonLink to={`/health/${d.id}`} variant="soft" className="min-h-11">
                      Add notes
                    </ButtonLink>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="suggested-heading">
          <SectionHeader
            id="suggested-heading"
            title="Suggested foods"
            aside={
              suggestions.length > 0 && (
                <Link to="/health/suggestions" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-700 hover:underline">
                  See all suggestions <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              )
            }
          />
          {suggestions.length === 0 ? (
            <EmptyState
              icon={<Salad aria-hidden="true" />}
              tone="mint"
              title={hasNotes ? 'No suggestions right now' : 'No suggestions yet'}
              description={hasNotes ? 'Add a goal or tick another health note to see more foods.' : 'Suggestions appear once a health note is added.'}
              action={myId ? <ButtonLink to={`/health/${myId}`}>Add a health note</ButtonLink> : undefined}
            />
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {suggestions.slice(0, SUGGESTION_LIMIT).map((food) => (
                  <li key={food.id}>
                    <FoodSuggestionCard food={food} list={list} headingLevel="h3" />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[0.8125rem] text-ink-subtle">{ADVICE_LINE}</p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
