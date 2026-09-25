import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { isDemoMode } from '@/services/config';
import { Button, Callout, Card, CardHeader } from '@/components/ui';

export function SecuritySection() {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="password-heading">
        <CardHeader title={<span id="password-heading">Password</span>} icon={<KeyRound aria-hidden="true" className="h-5 w-5" />} />
        <Callout tone="neutral">
          {isDemoMode
            ? 'In the demo, accounts live only on this device, so there is no password to change.'
            : 'Changing your password here isn’t available yet. To choose a new one, sign out and use “Forgot password?” on the sign-in page.'}
        </Callout>
        <Button className="mt-4" variant="secondary" disabled>
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
    </div>
  );
}
