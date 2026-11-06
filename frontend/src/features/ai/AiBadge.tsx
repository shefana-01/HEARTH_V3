import { Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { AiMode } from '@/services/ai/aiService';

/** Says which assistant answers: Google Gemini 2.5 Flash or the offline intelligent assistant. */
export function AiBadge({ mode, showModel = true }: { mode: AiMode; showModel?: boolean }) {
  const { t } = useTranslation();
  return mode === 'ai' ? (
    <Badge tone="primary" title="Answers powered by Google Gemini 2.5 Flash">
      <Sparkles aria-hidden="true" className="mr-1 h-3 w-3 text-primary-600" />
      {showModel ? 'Gemini 2.5 Flash' : t.ai.modeAi}
    </Badge>
  ) : (
    <Badge tone="neutral" title="Answers come from Hearth’s built-in intelligent assistant on this device">
      <Wand2 aria-hidden="true" className="mr-1 h-3 w-3" />
      {t.ai.modeBasic}
    </Badge>
  );
}
