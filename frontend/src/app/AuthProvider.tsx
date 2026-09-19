import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService, type Session, type SignUpInput } from '@/services/auth/authService';
import { SIGNED_OUT_EVENT } from '@/services/api/client';

interface AuthContextValue {
  status: 'loading' | 'ready';
  session: Session | null;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (input: SignUpInput) => Promise<Session>;
  startSample: () => Promise<Session>;
  signOut: () => Promise<void>;
  /** Re-read the session (e.g. after creating a family). */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    authService
      .getSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setStatus('ready'));
  }, []);

  // The API client fires this when a session has expired and could not be renewed.
  useEffect(() => {
    const onSignedOut = () => setSession(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await authService.signIn(email, password);
    setSession(s);
    return s;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const s = await authService.signUp(input);
    setSession(s);
    return s;
  }, []);

  const startSample = useCallback(async () => {
    const s = await authService.startSample();
    setSession(s);
    return s;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setSession(await authService.getSession());
  }, []);

  const value = useMemo(() => ({ status, session, signIn, signUp, startSample, signOut, refreshSession }), [status, session, signIn, signUp, startSample, signOut, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
