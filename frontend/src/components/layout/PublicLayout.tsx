import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu as MenuIcon, X } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { ButtonLink, IconButton } from '@/components/ui';
import { Logo } from './Logo';

const LINKS = [
  { href: '#problem', label: 'The problem' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#decisions', label: 'Handing over' },
  { href: '#family', label: 'For families' },
  { href: '#privacy', label: 'Privacy' },
];

export function PublicHeader({ sectionLinks = true }: { sectionLinks?: boolean }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo subtitle="Your day and your family" />
        {sectionLinks && (
          <nav aria-label="Page sections" className="hidden items-center gap-1 rounded-full border border-line bg-surface/80 p-1 lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          {session ? (
            <ButtonLink to="/today" size="sm">
              Open Hearth
            </ButtonLink>
          ) : (
            <>
              <Link to="/sign-in" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink sm:inline-block">
                Sign in
              </Link>
              <ButtonLink to="/sign-up" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
          {sectionLinks && (
            <IconButton label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="lg:hidden">
              {open ? <X aria-hidden="true" className="h-5 w-5" /> : <MenuIcon aria-hidden="true" className="h-5 w-5" />}
            </IconButton>
          )}
        </div>
      </div>
      {sectionLinks && open && (
        <nav aria-label="Page sections" className="border-t border-line bg-surface px-4 py-3 lg:hidden">
          <ul className="grid gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            {!session && (
              <li>
                <Link to="/sign-in" className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary-700">
                  Sign in
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface-muted/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-muted">Your day, and your family’s, in one place.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li>
              <a href="#how-it-works" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#decisions" className="hover:text-ink">
                Handing over
              </a>
            </li>
            <li>
              <a href="#privacy" className="hover:text-ink">
                Privacy
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Get started</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li>
              <Link to="/sign-up" className="hover:text-ink">
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/sign-in" className="hover:text-ink">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/join" className="hover:text-ink">
                Join with an invitation code
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-subtle sm:px-6">© {new Date().getFullYear()} Hearth. Hearth helps you plan and does not give medical advice.</p>
      </div>
    </footer>
  );
}
