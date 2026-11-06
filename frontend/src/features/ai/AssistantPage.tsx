import { Sparkles } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { GeminiChatStudio } from './GeminiChatStudio';
import { useAiStatus } from './useAiStatus';

/**
 * Dedicated Google Gemini / ChatGPT-style AI Assistant Studio for Hearth.
 */
export default function AssistantPage() {
  useDocumentTitle('AI Assistant');
  const { mode } = useAiStatus();

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary-600" />
            Conversational Intelligence
            <AiBadge mode={mode} />
          </span>
        }
        title="Hearth AI Assistant"
        description="Chat naturally just like Gemini or ChatGPT — grounded in your live Hearth classes, tasks, free windows, and family schedule."
      />
      <GeminiChatStudio />
    </>
  );
}
