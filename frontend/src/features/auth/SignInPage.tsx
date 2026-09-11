import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { authService } from '@/services/auth/authService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useAsync';
import { email as emailRule, required, validate } from '@/lib/validation';
import { Badge, Button, Card, Checkbox, Dialog, FormError, FormField, Input, PasswordInput } from '@/components/ui';
import { AuthLayout } from './AuthLayout';
import { SampleButton } from './SampleButton';

function ForgotPasswordDialog({ open, onClose, initialEmail }: { open: boolean; onClose: () => void; initialEmail: string }) {
  const [value, setValue] = useState(initialEmail);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const { run, pending } = useMutation(authService.requestPasswordReset);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate(value, required('Email'), emailRule);
    setError(err);
    if (err) return;
    await run(value);
    setSent(true);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setSent(false);
        onClose();
      }}
      title="Reset your password"
      description={sent ? undefined : 'We’ll email you a link to choose a new password.'}
      size="sm"
    >
      {sent ? (
        <p className="text-sm text-ink-muted">
          If an account exists for <span className="font-semibold text-ink">{value}</span>, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Email" error={error} required>
            {(p) => <Input {...p} type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} leftIcon={<Mail />} />}
          </FormField>
          <Button type="submit" block loading={pending}>
            Send reset link
          </Button>
        </form>
      )}
    </Dialog>
  );
}

/** Only follow in-app paths from `?next=`, never another site. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : null);

export default function SignInPage() {
  useDocumentTitle('Sign in');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const { run, pending, error } = useMutation(signIn);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: validate(form.email, required('Email'), emailRule),
      password: validate(form.password, required('Password')),
    };
    setErrors(next);
    if (next.email || next.password) return;
    const session = await run(form.email, form.password);
    if (session) navigate(safeNext(params.get('next')) ?? (session.hasFamily ? '/dashboard' : '/onboarding'), { replace: true });
  };

  return (
    <AuthLayout
      footer={
        <Card tone="mint" padding="sm" className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-mint-800">Just looking around? Try Hearth with a sample family.</p>
          <SampleButton size="sm" />
        </Card>
      }
    >
      <Card padding="lg" className="shadow-raised">
        <div className="mb-6 text-center">
          <Badge tone="rose" dot size="md" className="mb-3">
            Welcome back
          </Badge>
          <h1 className="font-display text-3xl">Sign in to Hearth</h1>
          <p className="mt-2 text-sm text-ink-muted">Coordinate care, schedules and daily support with your family.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={error} />
          <FormField label="Email" error={errors.email} required>
            {(p) => (
              <Input {...p} type="email" autoComplete="email" placeholder="you@example.com" leftIcon={<Mail />} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            )}
          </FormField>
          <FormField
            label="Password"
            error={errors.password}
            required
            aside={
              <button type="button" onClick={() => setForgotOpen(true)} className="rounded font-semibold text-primary-700 hover:underline">
                Forgot password?
              </button>
            }
          >
            {(p) => <PasswordInput {...p} autoComplete="current-password" leftIcon={<Lock />} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          </FormField>
          <Checkbox label="Keep me signed in on this device" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
          <Button type="submit" size="lg" block loading={pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Sign in
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-ink-muted">
            <UserPlus aria-hidden="true" className="h-4 w-4" /> New to Hearth?
          </span>
          <Link to={`/sign-up${params.get('invite') ? `?invite=${params.get('invite')}` : ''}`} className="font-semibold text-primary-700 hover:underline">
            Create an account
          </Link>
        </div>
      </Card>
      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={form.email} />
    </AuthLayout>
  );
}
