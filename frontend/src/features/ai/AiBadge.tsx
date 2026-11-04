import { Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { AiMode } from '@/services/ai/aiService';

/** Says which assistant answers: the server's AI or the offline one. */
export function AiBadge({ mode }: { mode: AiMode }) {
  const { t } = useTranslation();
  return mode === 'ai' ? (
    <Badge tone="primary" title="Answers come from AI help on the server">
      <Sparkles aria-hidden="true" className="mr-1 h-3 w-3" />
      {t.ai.modeAi}
    </Badge>
  ) : (
    <Badge tone="neutral" title="Answers come from Hearth’s built-in rules on this device; nothing is sent anywhere">
      <Wand2 aria-hidden="true" className="mr-1 h-3 w-3" />
      {t.ai.modeBasic}
    </Badge>
  );
}
