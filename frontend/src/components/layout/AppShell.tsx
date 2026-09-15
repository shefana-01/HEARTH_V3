import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarX2, LogOut, Menu as MenuIcon, Plus, Settings, Sparkles, UserRound, X } from 'lucide-react';
import { NAV_SECTIONS } from '@/constants/navigation';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { notificationService } from '@/services/notifications/notificationService';
import { cn } from '@/lib/cn';
import { Avatar, ButtonLink, IconButton, Menu } from '@/components/ui';
import { Logo } from './Logo';

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="eyebrow px-3 pb-2">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-primary-100 text-primary-800' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { family } = useFamily();
  return (
    <div className="space-y-2 border-t border-line p-3">
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium', isActive ? 'bg-primary-100 text-primary-800' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
        }
      >
        <Settings aria-hidden="true" className="h-[18px] w-[18px]" />
        Settings
      </NavLink>
      {family && (
        <div className="rounded-xl bg-mint-50 px-3 py-2.5">
          <p className="truncate text-[13px] font-semibold text-mint-800">{family.name}</p>
          <p className="truncate text-xs text-mint-700">Caring for {family.recipient.name}</p>
        </div>
      )}
    </div>
  );
}

function useUnreadCount() {
  const location = useLocation();
  const [count, setCount] = useState(() => notificationService.unreadCount());
  useEffect(() => {
    setCount(notificationService.unreadCount());
  }, [location]);
  useEffect(() => notificationService.subscribe(setCount), []);
  return count;
}

function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { session, signOut } = useAuth();
  const { me } = useFamily();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const name = me?.name ?? session?.account.name ?? '';

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <IconButton label="Open navigation" onClick={onOpenNav} className="lg:hidden">
          <MenuIcon aria-hidden="true" className="h-5 w-5" />
        </IconButton>
        <div className="lg:hidden">
          <Logo to="/dashboard" />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {session?.isSample && (
            <span className="hidden items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 md:inline-flex">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Sample data
            </span>
          )}
          <ButtonLink to="/schedule/unavailable" variant="ghost" size="sm" className="hidden xl:inline-flex" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
            Report unavailability
          </ButtonLink>
          <ButtonLink to="/tasks/new" size="sm" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} className="hidden sm:inline-flex">
            New task
          </ButtonLink>
          <NavLink
            to="/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Bell aria-hidden="true" className="h-5 w-5" />
            {unread > 0 && (
              <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
          <Menu
            items={[
              { label: 'Profile & settings', icon: <UserRound aria-hidden="true" />, onSelect: () => navigate('/settings') },
              {
                label: 'Sign out',
                icon: <LogOut aria-hidden="true" />,
                onSelect: async () => {
                  await signOut();
                  navigate('/sign-in', { replace: true });
                },
              },
            ]}
            trigger={({ ref, ...props }) => (
              <button ref={ref} type="button" {...props} aria-label={`Account menu for ${name}`} className="flex items-center gap-2.5 rounded-xl p-1 pr-1 hover:bg-surface-sunken sm:pr-2.5">
                <Avatar name={name || 'You'} seed={me?.id} size="sm" />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-semibold text-ink">{name}</span>
                  <span className="block text-xs text-ink-subtle">{me?.role === 'lead' ? 'Lead caregiver' : 'Caregiver'}</span>
                </span>
              </button>
            )}
          />
        </div>
      </div>
    </header>
  );
}

/** Signed-in application layout: sidebar (drawer on small screens) + top bar + page. */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface-muted/70 lg:flex">
        <div className="px-5 pb-5 pt-5">
          <Logo to="/dashboard" subtitle="Family care coordination" />
        </div>
        <SidebarNav />
        <SidebarFooter />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" tabIndex={-1} className="absolute inset-0 animate-fade-in bg-ink/30" onClick={() => setNavOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[85vw] animate-slide-in-left flex-col bg-surface shadow-overlay">
            <div className="flex items-center justify-between px-4 pb-4 pt-4">
              <Logo to="/dashboard" />
              <IconButton label="Close navigation" onClick={() => setNavOpen(false)}>
                <X aria-hidden="true" className="h-5 w-5" />
              </IconButton>
            </div>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
            <SidebarFooter onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-content px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
