import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { familyService } from '@/services/family/familyService';
import type { Family, FamilyMember } from '@/types/domain';

interface FamilyContextValue {
  status: 'loading' | 'ready' | 'error';
  family: Family | null;
  members: FamilyMember[];
  /** The signed-in person's member record. */
  me: FamilyMember | undefined;
  isLead: boolean;
  memberById: (id: string | null | undefined) => FamilyMember | undefined;
  /** Display name for any member id, with a friendly fallback. */
  nameOf: (id: string | null | undefined) => string;
  firstNameOf: (id: string | null | undefined) => string;
  refresh: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

/** Shared family + member data so every page can resolve names without refetching. */
export function FamilyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const accountId = session?.account.id ?? null;
  const [loaded, setLoaded] = useState<{ accountId: string | null; status: 'ready' | 'error'; family: Family | null; members: FamilyMember[] }>({
    accountId: null,
    status: 'ready',
    family: null,
    members: [],
  });

  // Keep the id in a ref so `refresh` stays stable and always loads for the current account.
  const accountRef = useRef(accountId);
  accountRef.current = accountId;

  const refresh = useCallback(async () => {
    const forAccount = accountRef.current;
    if (!forAccount) return;
    try {
      const [f, m] = await Promise.all([familyService.getFamily(), familyService.listMembers()]);
      if (accountRef.current === forAccount) setLoaded({ accountId: forAccount, status: 'ready', family: f, members: m });
    } catch {
      if (accountRef.current === forAccount) setLoaded((prev) => ({ ...prev, accountId: forAccount, status: 'error' }));
    }
  }, []);

  // Reload only when the signed-in account changes, not on every session refresh.
  useEffect(() => {
    if (accountId) void refresh();
    else setLoaded({ accountId: null, status: 'ready', family: null, members: [] });
  }, [accountId, refresh]);

  // Data is only trusted once it was loaded for the account that is signed in now. Deriving this
  // (instead of setting it in an effect) avoids a render where a fresh session looks family-less.
  const current = loaded.accountId === accountId;
  const status: FamilyContextValue['status'] = !accountId ? 'ready' : current ? loaded.status : 'loading';
  const family = accountId && current ? loaded.family : null;
  const members = useMemo(() => (accountId && current ? loaded.members : []), [accountId, current, loaded.members]);

  const value = useMemo<FamilyContextValue>(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const memberById = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
    const nameOf = (id: string | null | undefined) => memberById(id)?.name ?? (id ? 'Former member' : 'Unassigned');
    const me = session ? byId.get(session.account.memberId) : undefined;
    return {
      status,
      family,
      members,
      me,
      isLead: me?.role === 'lead',
      memberById,
      nameOf,
      firstNameOf: (id) => nameOf(id).split(' ')[0],
      refresh,
    };
  }, [status, family, members, session, refresh]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>.');
  return ctx;
}
