import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CalendarDays, CalendarX2, CircleCheckBig, Ellipsis, House, LogOut, Plus, Settings, Sparkles, UserRound, Users, X } from 'lucide-react';
import { NAV_SECTIONS, type NavItem } from '@/constants/navigation';
import { isRouteMeta } from '@/app/routeMeta';
import { useMinWidth } from '@/hooks/useMediaQuery';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { EmailConfirmNotice } from '@/components/domain/EmailConfirmNotice';
import { notificationService } from '@/services/notifications/notificationService';
import { cn } from '@/lib/cn';
import { Avatar, ButtonLink, IconButton, Menu } from '@/components/ui';
import { Logo } from './Logo';
import { ShellContext, type ShellContextValue } from './ShellContext';

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
    notificationService.refresh();
  }, [location]);
  useEffect(() => notificationService.subscribe(setCount), []);
  return count;
}

/** Metadata of the deepest matched route that declares itself a detail screen. */
function useRouteMeta() {
  const matches = useMatches();
  const location = useLocation();
  const match = [...matches].reverse().find((m) => isRouteMeta(m.handle));
  if (!match || !isRouteMeta(match.handle)) return null;
  return { title: match.handle.title, backTo: match.handle.back(match.params, location.search) };
}

function Topbar({ meta }: { meta: ReturnType<typeof useRouteMeta> }) {
  const { session, signOut } = useAuth();
  const { me } = useFamily();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const name = me?.name ?? session?.account.name ?? '';

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* Phones & tablets: back + title on detail screens, logo elsewhere. Desktop uses the sidebar. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 lg:hidden">
          {meta ? (
            <>
              <Link to={meta.backTo} aria-label="Back" className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-surface-sunken">
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <p className="truncate font-display text-lg text-ink">{meta.title}</p>
            </>
          ) : (
            <Logo to="/dashboard" />
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {session?.isSample && (
            <span className="hidden items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 md:inline-flex">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Sample data
            </span>
          )}
          <ButtonLink to="/schedule/unavailable" variant="ghost" size="sm" className="hidden xl:inline-flex" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
            Report unavailability
          </ButtonLink>
          <ButtonLink to="/tasks/new" size="sm" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} className="hidden lg:inline-flex">
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
              <button ref={ref} type="button" {...props} aria-label={`Account menu for ${name}`} className="flex items-center gap-2.5 rounded-xl p-1 pr-1 hover:bg-surface-sunken lg:pr-2.5">
                <Avatar name={name || 'You'} seed={me?.id} src={me?.photo} size="sm" />
                <span className="hidden text-left leading-tight lg:block">
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

const TABS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: House },
  { to: '/tasks', label: 'Tasks', icon: CircleCheckBig },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/family', label: 'Family', icon: Users },
];

/** Phone & tablet primary navigation: four destinations plus "More" for everything else. */
function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { pathname } = useLocation();
  const inTabs = TABS.some((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
  const item = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors';
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto flex h-16 max-w-xl items-stretch gap-1 px-2 py-1.5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex flex-1">
            <NavLink to={to} className={({ isActive }) => cn(item, isActive ? 'bg-primary-100 text-primary-800' : 'text-ink-subtle hover:text-ink')}>
              <Icon aria-hidden="true" className="h-5 w-5" />
              {label}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={!inTabs ? 'page' : undefined}
            className={cn(item, !inTabs || moreOpen ? 'bg-primary-100 text-primary-800' : 'text-ink-subtle hover:text-ink')}
          >
            <Ellipsis aria-hidden="true" className="h-5 w-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** "More" bottom sheet. Native <dialog> gives focus trapping, Escape and focus return. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const desktop = useMinWidth('lg');
  // The sheet is a small-screen pattern; close it if the window grows to desktop width.
  useEffect(() => {
    if (desktop && open) onClose();
  }, [desktop, open, onClose]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    // Clicking the backdrop closes the sheet; keyboard users get Escape via the native `cancel` event.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label="All sections"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[85vh] w-full max-w-none rounded-t-3xl border-0 bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/30 open:flex open:animate-slide-up open:flex-col lg:hidden"
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
        <p className="pt-3 font-display text-lg">All sections</p>
        <IconButton label="Close" onClick={onClose} className="mt-2">
          <X aria-hidden="true" className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <SidebarNav onNavigate={onClose} />
        <SidebarFooter onNavigate={onClose} />
      </div>
    </dialog>
  );
}

/**
 * Signed-in application layout.
 * - Desktop (lg+): fixed sidebar + top bar.
 * - Phones & tablets: app bar (logo, or back + title on detail screens), bottom tab bar on
 *   top-level screens, and a "More" sheet for the remaining sections.
 */
export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const location = useLocation();
  const meta = useRouteMeta();
  const hasTabBar = !meta;
  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const shell = useMemo<ShellContextValue>(() => ({ hasMobileBack: Boolean(meta), hasTabBar, setActionBarHeight }), [meta, hasTabBar]);

  // Room for whatever is pinned to the bottom on small screens (tab bar and/or action bar).
  const bottomChrome = `calc(${actionBarHeight}px + ${hasTabBar ? '4rem + env(safe-area-inset-bottom)' : '0px'} + 1.5rem)`;

  return (
    <ShellContext.Provider value={shell}>
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

        <div className="lg:pl-64">
          <Topbar meta={meta} />
          <main
            id="main"
            tabIndex={-1}
            style={{ '--bottom-chrome': bottomChrome } as CSSProperties}
            className="mx-auto w-full max-w-content px-4 pb-[var(--bottom-chrome)] pt-6 focus:outline-none sm:px-6 sm:pt-8 lg:px-8 lg:pb-8"
          >
            <EmailConfirmNotice className="mb-6" />
            <Outlet />
          </main>
        </div>

        {hasTabBar && <TabBar onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />}
        <MoreSheet open={moreOpen} onClose={closeMore} />
      </div>
    </ShellContext.Provider>
  );
}
