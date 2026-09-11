import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CircleCheck, Circle, Heart, Mail, UserRound } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useAsync';
import { email as emailRule, maxLength, minLength, PASSWORD_RULES, passwordError, required, validate } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { Badge, Button, Callout, Card, Checkbox, FormError, FormField, Input, PasswordInput } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm' | 'terms', string>>;

export default function SignUpPage() {
  useDocumentTitle('Create an account');
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invite = params.get('invite');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const { run, pending, error } = useMutation(signUp);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      name: validate(form.name, required('Your name'), minLength('Your name', 2), maxLength('Your name', 80)),
      email: validate(form.email, required('Email'), emailRule),
      password: passwordError(form.password),
      confirm: !form.confirm ? 'Please confirm your password.' : form.confirm !== form.password ? 'The passwords don’t match.' : undefined,
      terms: form.terms ? undefined : 'Please accept the terms to continue.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const session = await run({ name: form.name, email: form.email, password: form.password });
    if (session) navigate(invite ? `/join/${invite}` : '/onboarding', { replace: true });
  };

  return (
    <AuthLayout
      footer={
        <Card tone="mint" padding="sm" className="text-center text-sm text-mint-800">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-semibold text-mint-800 underline-offset-2 hover:underline">
            Sign in
          </Link>
        </Card>
      }
    >
      <Card padding="lg" className="shadow-raised">
        <div className="mb-6 text-center">
          <Badge tone="mint" size="md" className="mb-3 gap-1.5">
            <Heart aria-hidden="true" className="h-3 w-3" /> A calm place for family care
          </Badge>
          <h1 className="font-display text-3xl">Create your account</h1>
          <p className="mt-2 text-sm text-ink-muted">Set up in minutes. You’ll create or join a family circle next.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={error} />
          <FormField label="Full name" error={errors.name} required>
            {(p) => <Input {...p} autoComplete="name" placeholder="Your name" leftIcon={<UserRound />} value={form.name} onChange={(e) => set('name', e.target.value)} />}
          </FormField>
          <FormField label="Email" error={errors.email} required>
            {(p) => <Input {...p} type="email" autoComplete="email" placeholder="you@example.com" leftIcon={<Mail />} value={form.email} onChange={(e) => set('email', e.target.value)} />}
          </FormField>
          <FormField label="Password" error={errors.password} required>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />}
          </FormField>
          <ul aria-label="Password requirements" className="grid gap-1.5 rounded-xl bg-surface-muted px-3.5 py-3 sm:grid-cols-3">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(form.password);
              return (
                <li key={rule.id} className={cn('flex items-center gap-1.5 text-[13px]', ok ? 'font-semibold text-mint-700' : 'text-ink-subtle')}>
                  {ok ? <CircleCheck aria-hidden="true" className="h-4 w-4" /> : <Circle aria-hidden="true" className="h-4 w-4" />}
                  {rule.label}
                  <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
                </li>
              );
            })}
          </ul>
          <FormField label="Confirm password" error={errors.confirm} required>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />}
          </FormField>
          <div>
            <Checkbox
              label="I agree to the Terms of Use and Privacy Notice"
              checked={form.terms}
              onChange={(e) => set('terms', e.target.checked)}
              aria-invalid={errors.terms ? true : undefined}
            />
            {errors.terms && <p className="mt-1.5 text-[13px] font-medium text-red-600">{errors.terms}</p>}
          </div>
          <Button type="submit" size="lg" block loading={pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Create account
          </Button>
          <Callout tone="rose" className="text-[13px]">
            No medical or schedule details are needed right now — we’ll set those up together after you join.
          </Callout>
        </form>
      </Card>
    </AuthLayout>
  );
}
