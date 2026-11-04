import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Card, CardHeader, ProgressBar, Switch, useToast } from '@/components/ui';
import { isDemoMode } from '@/services/config';
import { useAiStatus } from '@/features/ai/useAiStatus';

/** Turn AI help on or off, see what is sent, and how much of the allowance is used. */
export function AiSection() {
  const { status, setConsent } = useAiStatus();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const toggle = async (on: boolean) => {
    setPending(true);
    try {
      await setConsent(on);
      toast({ title: on ? 'AI help is on' : 'AI help is off', description: on ? undefined : 'Nothing more is sent. Quick add and planning keep working in basic mode.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t change AI help', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card as="section" aria-labelledby="ai-heading">
      <CardHeader title={<span id="ai-heading">AI help</span>} icon={<Sparkles aria-hidden="true" className="h-5 w-5" />} />
      <div className="space-y-3 text-sm text-ink-muted">
        <p>AI help turns a sentence into tasks, suggests a plan for your week and drafts messages. You always check the result before anything is saved or sent.</p>
        <p>
          <strong className="text-ink">What is sent:</strong> what you type into an AI box, the titles and times of shared tasks, and family first names.{' '}
          <strong className="text-ink">Never sent:</strong> private task titles, health notes, documents, email addresses or phone numbers.
        </p>
        {isDemoMode && <p>In the demo, the built-in basic mode answers on this device and nothing is sent anywhere.</p>}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        {status && !status.enabled && !isDemoMode ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Badge tone="neutral">Off on this Hearth</Badge> The server has no AI key set, so the basic mode is used. Ask whoever runs Hearth to add one.
          </p>
        ) : (
          <Switch
            checked={Boolean(status?.consented)}
            onChange={(on) => void toggle(on)}
            disabled={!status || pending || isDemoMode}
            label="Use AI help"
            description={isDemoMode ? 'Available when Hearth runs with its server.' : 'You can turn it off at any time; nothing more is sent after that.'}
          />
        )}
        {status?.enabled && status.consented && (
          <div className="mt-4 space-y-3">
            <ProgressBar value={status.usedToday} max={Math.max(1, status.dailyLimit)} label="AI requests today" />
            <p className="text-xs text-ink-subtle">
              {status.usedToday} of {status.dailyLimit} requests today · {status.monthlyBudgetUsedPercent}% of the family’s monthly allowance used
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
