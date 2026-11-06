import { Bot, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { AiMode, AiModelProvider } from '@/services/ai/aiService';
import { useAiStatus } from './useAiStatus';

/** Shows which free AI model is currently active: Google Gemini 2.5 Flash or ChatGPT 4o-mini. */
export function AiBadge({ provider: providerProp }: { mode?: AiMode; showModel?: boolean; provider?: AiModelProvider }) {
  const { provider: stateProvider } = useAiStatus();
  const active = providerProp ?? stateProvider;

  return active === 'chatgpt' ? (
    <Badge tone="primary" title="Powered by ChatGPT 4o-mini (Free Tier) + Hearth Schedule Engine">
      <Bot aria-hidden="true" className="mr-1 h-3 w-3 text-primary-600" />
      ChatGPT 4o-mini · Free
    </Badge>
  ) : (
    <Badge tone="primary" title="Powered by Google Gemini 2.5 Flash (Free Tier) + Hearth Schedule Engine">
      <Sparkles aria-hidden="true" className="mr-1 h-3 w-3 text-primary-600" />
      Gemini 2.5 Flash · Free
    </Badge>
  );
}
