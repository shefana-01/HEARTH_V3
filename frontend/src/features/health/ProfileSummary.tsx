import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { conditionLabels } from './healthText';
import type { HealthProfile } from '@/types/domain';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/** The ticked health notes of a person as chips. */
export function ConditionChips({ ids }: { ids: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {conditionLabels(ids).map((label) => (
        <li key={label}>
          <Badge tone="mint" size="md">
            {label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Everything in a health profile, read-only. */
export function ProfileSummary({ profile, withNotes = false }: { profile: HealthProfile; withNotes?: boolean }) {
  return (
    <div className="space-y-4">
      {profile.conditions.length > 0 && (
        <Row label="Told by a doctor">
          <ConditionChips ids={profile.conditions} />
        </Row>
      )}
      {profile.goals.length > 0 && (
        <Row label="Goals">
          <ul className="space-y-1 text-sm text-ink">
            {profile.goals.map((goal) => (
              <li key={goal.id}>
                <span className="font-semibold">{goal.title}</span>
                {goal.target && <span className="text-ink-muted"> — {goal.target}</span>}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {profile.avoid.length > 0 && (
        <Row label="Foods to leave out">
          <p className="text-sm text-ink">{profile.avoid.join(', ')}</p>
        </Row>
      )}
      {profile.preferences.length > 0 && (
        <Row label="Foods liked">
          <p className="text-sm text-ink">{profile.preferences.join(', ')}</p>
        </Row>
      )}
      {withNotes && profile.notes && (
        <Row label="Notes">
          <p className="whitespace-pre-line text-sm text-ink">{profile.notes}</p>
        </Row>
      )}
    </div>
  );
}
