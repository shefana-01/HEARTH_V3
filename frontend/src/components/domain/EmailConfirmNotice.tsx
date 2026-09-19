import { MailWarning } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { authService } from '@/services/auth/authService';
import { useMutation } from '@/hooks/useAsync';
import { Button, Callout, useToast } from '@/components/ui';

/** Shown while the signed-in account has not opened the confirmation link we emailed. */
export function EmailConfirmNotice({ className }: { className?: string }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const resend = useMutation(authService.resendVerification);

  // Only `false` counts: the offline demo has no email, so the field is absent there.
  if (!session || session.account.emailVerified !== false) return null;

  const onResend = async () => {
    if (await resend.attempt()) toast({ title: 'Link sent', description: `Check the inbox for ${session.account.email}.` });
  };

  return (
    <Callout
      tone="amber"
      icon={<MailWarning aria-hidden="true" />}
      title="Confirm your email address"
      className={className}
      action={
        <Button size="sm" variant="secondary" loading={resend.pending} onClick={onResend}>
          Send the link again
        </Button>
      }
    >
      We sent a link to <span className="font-semibold text-ink">{session.account.email}</span>. Open it to confirm the address is yours. You need this before you can join a family you were invited
      to.
      {resend.error && (
        <span role="alert" className="mt-1 block font-medium text-red-700">
          {resend.error}
        </span>
      )}
    </Callout>
  );
}
