import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Callout, useToast } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useAiStatus } from './useAiStatus';

/** Shown where AI help could be used but the person has not agreed yet. Without agreement the basic mode answers. */
export function AiConsentCallout({ compact = false }: { compact?: boolean }) {
  const { status, setConsent } = useAiStatus();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  if (!status?.enabled || status.consented) return null;

  const turnOn = async () => {
    setPending(true);
    try {
      await setConsent(true);
      toast({ title: 'AI help is on', description: 'You can turn it off in Settings at any time.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t turn on AI help', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
    }
  };

  return (
    <Callout
      tone="primary"
      icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
      title="Smarter answers with AI help"
      action={
        <Button size="sm" onClick={() => void turnOn()} loading={pending}>
          {t.ai.turnOn}
        </Button>
      }
    >
      {!compact && (
        <p>
          With AI help on, what you type, the titles of shared tasks and family first names are sent to Hearth’s AI provider to write the answer. Private task titles, health notes and documents are
          never sent. Until then the built-in basic mode answers on this device.
        </p>
      )}
    </Callout>
  );
}
