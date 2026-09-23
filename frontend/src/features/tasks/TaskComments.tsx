import { useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { chatService, MAX_MESSAGE_LENGTH, taskChannel } from '@/services/chat/chatService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { timeAgo } from '@/lib/dates';
import { Avatar, Button, Card, CardHeader, ErrorState, ListSkeleton, FormError, Textarea } from '@/components/ui';

/** The comment thread under a shared task. */
export function TaskComments({ taskId }: { taskId: string }) {
  const { firstNameOf, nameOf } = useFamily();
  const [text, setText] = useState('');
  const thread = useAsync(() => chatService.list(taskChannel(taskId)), [taskId]);
  const send = useMutation((body: string) => chatService.send(taskChannel(taskId), body));
  const comments = (thread.data ?? []).filter((m) => m.kind === 'text');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = await send.run(text);
    if (!message) return;
    thread.setData((prev) => [...(prev ?? []), message]);
    setText('');
  };

  return (
    <Card as="section" aria-label="Comments">
      <CardHeader title="Comments" icon={<MessageSquare aria-hidden="true" className="h-5 w-5" />} />
      {thread.status === 'error' ? (
        <ErrorState headingLevel="h3" title="We couldn’t load the comments" message={thread.error?.message} onRetry={thread.reload} />
      ) : !thread.data ? (
        <ListSkeleton rows={2} />
      ) : comments.length ? (
        <ul className="space-y-4">
          {comments.map((m) => (
            <li key={m.id} className="flex gap-3">
              <Avatar name={nameOf(m.authorId)} seed={m.authorId ?? 'hearth'} size="sm" />
              <div className="min-w-0 text-sm">
                <p className="text-ink">
                  <span className="font-semibold">{firstNameOf(m.authorId)}</span> <span className="text-xs text-ink-subtle">{timeAgo(m.createdAt)}</span>
                </p>
                <p className="whitespace-pre-line text-ink-muted">{m.text}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No comments yet. Leave a note for whoever does this.</p>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-2">
        <FormError message={send.error} />
        <label htmlFor="comment-text" className="sr-only">
          Write a comment
        </label>
        <Textarea id="comment-text" rows={2} value={text} maxLength={MAX_MESSAGE_LENGTH} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-subtle">
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <Button type="submit" className="min-h-11" disabled={!text.trim()} loading={send.pending} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
