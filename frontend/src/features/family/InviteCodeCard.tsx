import { Copy, KeyRound } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { Button, Card, useToast } from '@/components/ui';

/** The family code people use to join, with a count of who is in and who is still invited. */
export function InviteCodeCard() {
  const { family, members } = useFamily();
  const { toast } = useToast();
  if (!family) return null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      toast({ title: 'Family code copied', description: family.inviteCode });
    } catch {
      toast({ tone: 'error', title: 'Couldn’t copy', description: `Your code is ${family.inviteCode}.` });
    }
  };

  return (
    <Card as="aside" aria-labelledby="code-heading">
      <p className="eyebrow flex items-center gap-1.5">
        <KeyRound aria-hidden="true" className="h-3.5 w-3.5" /> Family code
      </p>
      <h2 id="code-heading" className="sr-only">
        Family code
      </h2>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-wider text-ink">{family.inviteCode}</p>
      <p className="mt-1 text-sm text-ink-muted">People you invite use this code to join.</p>
      <Button variant="soft" className="mt-3 h-11" onClick={copyCode} leftIcon={<Copy aria-hidden="true" className="h-4 w-4" />}>
        Copy code
      </Button>
      <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4 text-center">
        <div>
          <dt className="text-xs text-ink-subtle">Joined</dt>
          <dd className="font-display text-xl">{members.filter((m) => m.status === 'active').length}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Invited</dt>
          <dd className="font-display text-xl">{members.filter((m) => m.status === 'invited').length}</dd>
        </div>
      </dl>
    </Card>
  );
}
