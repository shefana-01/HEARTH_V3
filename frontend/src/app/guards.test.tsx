import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'loading', session: null as null | { hasFamily: boolean } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('./FamilyProvider', () => ({ useFamily: () => ({ status: 'ready', family: null, refresh: vi.fn() }) }));

const { RedirectIfAuthed, RequireAuth } = await import('./guards');

function Where() {
  const location = useLocation();
  return <p>at {location.pathname + location.search}</p>;
}

describe('route guards', () => {
  it('sends a signed-out visitor to sign-in and remembers where they were going', () => {
    auth.session = null;
    render(
      <MemoryRouter initialEntries={['/tasks?filter=today']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/tasks"
            element={
              <RequireAuth>
                <p>tasks</p>
              </RequireAuth>
            }
          />
          <Route path="/sign-in" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('at /sign-in?next=%2Ftasks%3Ffilter%3Dtoday')).toBeInTheDocument();
  });

  it('sends a signed-in person without a family from sign-in to onboarding', () => {
    auth.session = { hasFamily: false };
    render(
      <MemoryRouter initialEntries={['/sign-in']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/sign-in"
            element={
              <RedirectIfAuthed>
                <p>sign in</p>
              </RedirectIfAuthed>
            }
          />
          <Route path="/onboarding" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('at /onboarding')).toBeInTheDocument();
  });
});
