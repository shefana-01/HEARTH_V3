import { MessagesSquare } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { chatService } from '@/services/chat/chatService';
import { useAsync } from '@/hooks/useAsync';
import { timeAgo } from '@/lib/dates';
import { ButtonLink, Card, CardHeader, ListSkeleton } from '@/components/ui';
import { BlockError } from './BlockError';
import type { Message } from '@/types/domain';

function PreviewLine({ message }: { message: Message }) {
  const { firstNameOf } = useFamily();
  const author = firstNameOf(message.authorId);
  return (
    <li className="text-sm">
      {message.kind === 'system' ? (
        <p className="text-ink-subtle">{message.text}</p>
      ) : (
        <p className={message.kind === 'status' ? 'italic text-ink-muted' : 'text-ink'}>
          <span className="font-semibold">{author}</span>
          {': '}
          <span className="line-clamp-2 break-words">{message.text}</span>
        </p>
      )}
      <p className="text-xs text-ink-subtle">{timeAgo(message.createdAt)}</p>
    </li>
  );
}

/** The last few messages of the family chat. */
export function ChatPreviewCard() {
  const chat = useAsync(() => chatService.list('family'), []);
  const latest = (chat.data ?? []).slice(-3);

  return (
    <Card as="section" aria-labelledby="chat-preview-heading">
      <CardHeader title={<span id="chat-preview-heading">Family chat</span>} icon={<MessagesSquare aria-hidden="true" className="h-5 w-5" />} />
      {chat.status === 'error' ? (
        <BlockError onRetry={chat.reload} />
      ) : !chat.data ? (
        <ListSkeleton rows={2} />
      ) : latest.length === 0 ? (
        <p className="text-sm text-ink-muted">No messages yet. Say hello, or tell your family what you are up to.</p>
      ) : (
        <ul className="space-y-3">
          {latest.map((m) => (
            <PreviewLine key={m.id} message={m} />
          ))}
        </ul>
      )}
      <ButtonLink to="/chat" variant="soft" className="mt-4 h-11" block>
        Open chat
      </ButtonLink>
    </Card>
  );
}
