import { useEffect, useState } from 'react';
import { Copy, MessageSquareText, Send, Share2, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type DraftKind, type DraftLanguage, type DraftTone } from '@/services/ai/aiService';
import { chatService, taskChannel } from '@/services/chat/chatService';
import { useTranslation } from '@/i18n';
import { Button, Dialog, FormError, FormField, SegmentedControl, Select, Textarea, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { AiConsentCallout } from './AiConsentCallout';
import { useAiStatus } from './useAiStatus';

const TITLES: Record<DraftKind, string> = {
  'handover-request': 'Ask someone to take over',
  reminder: 'Write a reminder',
  'chat-message': 'Help me write',
  'weekly-summary': 'The family’s week',
};

/**
 * A message draft the person edits and sends themselves: asking for a handover, a reminder, a chat
 * message from a few words, or the week in a few lines.
 */
export function DraftDialog({
  open,
  onClose,
  kind,
  taskId,
  toMemberId,
  initialPoints = '',
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  kind: DraftKind;
  taskId?: string;
  toMemberId?: string;
  initialPoints?: string;
  /** Put the text somewhere (e.g. the chat box) instead of sending it from here. */
  onUse?: (text: string) => void;
}) {
  const { members, me, nameOf } = useFamily();
  const { mode, refresh } = useAiStatus();
  const { language: uiLanguage, t } = useTranslation();
  const { toast } = useToast();
  const [to, setTo] = useState(toMemberId ?? '');
  const [points, setPoints] = useState(initialPoints);
  const [tone, setTone] = useState<DraftTone>('friendly');
  const [language, setLanguage] = useState<DraftLanguage>(uiLanguage);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<'write' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(toMemberId ?? '');
      setPoints(initialPoints);
      setText('');
      setError(null);
    }
  }, [open, toMemberId, initialPoints]);

  const others = members.filter((m) => m.status === 'active' && m.id !== me?.id);
  const needsRecipient = kind !== 'weekly-summary';

  const write = async () => {
    setPending('write');
    setError(null);
    try {
      const draft = await aiService.draft({ kind, taskId, toMemberId: to || undefined, points: points.trim() || undefined, tone, language }, mode, { me: me?.name ?? '', nameOf: (id) => nameOf(id) });
      setText(draft);
      if (mode === 'ai') void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied' });
    } catch {
      toast({ tone: 'error', title: 'Couldn’t copy', description: 'Select the text and copy it yourself.' });
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // Cancelled or not supported: nothing to do.
    }
  };

  const send = async (channel: 'family' | 'task') => {
    setPending('send');
    try {
      await chatService.send(channel === 'task' && taskId ? taskChannel(taskId) : 'family', text);
      toast({ title: channel === 'task' ? 'Posted in the task’s conversation' : 'Sent to the family chat' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The message couldn’t be sent.');
    } finally {
      setPending(null);
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          {TITLES[kind]} <AiBadge mode={mode} />
        </span>
      }
      description="Hearth writes a first draft. Change anything you like before you send it."
      footer={
        text ? (
          <>
            <Button variant="secondary" onClick={() => void copy()} leftIcon={<Copy aria-hidden="true" className="h-4 w-4" />}>
              {t.ai.copy}
            </Button>
            {canShare && (
              <Button variant="secondary" onClick={() => void share()} leftIcon={<Share2 aria-hidden="true" className="h-4 w-4" />}>
                Share
              </Button>
            )}
            {onUse ? (
              <Button
                onClick={() => {
                  onUse(text);
                  onClose();
                }}
              >
                {t.ai.useText}
              </Button>
            ) : (
              <>
                {taskId && kind !== 'weekly-summary' && (
                  <Button variant="secondary" onClick={() => void send('task')} loading={pending === 'send'} leftIcon={<MessageSquareText aria-hidden="true" className="h-4 w-4" />}>
                    Post on the task
                  </Button>
                )}
                <Button onClick={() => void send('family')} loading={pending === 'send'} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
                  Send to family chat
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void write()} loading={pending === 'write'} leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}>
              {t.ai.write}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <AiConsentCallout compact />
        {needsRecipient && (
          <FormField label="Who is it for?" aside="Optional">
            {(field) => (
              <Select {...field} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">{kind === 'chat-message' ? 'Everyone' : 'Whoever can help'}</option>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
        <FormField label={kind === 'chat-message' ? 'What do you want to say?' : 'Anything to add?'} aside={kind === 'chat-message' ? undefined : 'Optional'}>
          {(field) => <Textarea {...field} voice rows={3} maxLength={500} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="A few words is enough" />}
        </FormField>
        <div className="flex flex-wrap gap-4">
          <SegmentedControl
            label={t.ai.tone}
            value={tone}
            onChange={setTone}
            options={[
              { value: 'friendly', label: t.ai.friendly },
              { value: 'formal', label: t.ai.formal },
              { value: 'short', label: t.ai.short },
            ]}
          />
          <SegmentedControl
            label={t.ai.writeIn}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'bn', label: 'বাংলা' },
            ]}
          />
        </div>
        {text && <FormField label="Draft">{(field) => <Textarea {...field} rows={6} value={text} onChange={(e) => setText(e.target.value)} lang={language} />}</FormField>}
        {text && (
          <Button variant="ghost" size="sm" onClick={() => void write()} loading={pending === 'write'} leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}>
            Write it again
          </Button>
        )}
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
