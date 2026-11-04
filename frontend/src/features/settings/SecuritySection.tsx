import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { authService } from '@/services/auth/authService';
import { isDemoMode } from '@/services/config';
import { useMutation } from '@/hooks/useAsync';
import { Button, Callout, Card, CardHeader, Dialog, useToast } from '@/components/ui';

function ChangePasswordDialog({ open, onClose, email }: { open: boolean; onClose: () => void; email?: string }) {
  const [sent, setSent] = useState(false);
  const { run, pending } = useMutation(authService.requestPasswordReset);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!email) return;
    await run(email);
    setSent(true);
    toast({ title: 'Password reset link sent', description: `Check ${email} for instructions.` });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setSent(false);
        onClose();
      }}
      title="Change your password"
      description={sent ? undefined : `We’ll email a secure password reset link to ${email || 'your address'}.`}
      size="sm"
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            We’ve sent instructions to <span className="font-semibold text-ink">{email}</span>. Click the link in that email to choose a new password.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">For security, password changes are confirmed via a reset link sent to your registered email address.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleSend} loading={pending} leftIcon={<Mail aria-hidden="true" className="h-4 w-4" />}>
              Send reset link
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function SecuritySection() {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="password-heading">
        <CardHeader title={<span id="password-heading">Password</span>} icon={<KeyRound aria-hidden="true" className="h-5 w-5" />} />
        <Callout tone="neutral">
          {isDemoMode
            ? 'In local demo mode, accounts live in this browser session. Requesting a reset will simulate sending the reset email.'
            : 'To update your password, request a secure link sent to your verified email address.'}
        </Callout>
        <Button className="mt-4" variant="secondary" onClick={() => setResetOpen(true)}>
          Change password
        </Button>
      </Card>
      <Card as="section" aria-labelledby="session-heading">
        <CardHeader title={<span id="session-heading">This device</span>} icon={<LogOut aria-hidden="true" className="h-5 w-5" />} />
        <p className="text-sm text-ink-muted">
          Signed in as <span className="font-semibold text-ink">{session?.account.email}</span>.{session?.isSample && ' Leaving the sample family clears its data.'}
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          leftIcon={<LogOut aria-hidden="true" className="h-4 w-4" />}
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          Sign out
        </Button>
      </Card>
      <ChangePasswordDialog open={resetOpen} onClose={() => setResetOpen(false)} email={session?.account.email} />
    </div>
  );
}
