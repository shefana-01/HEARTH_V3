import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('ignores the answer to an older request when the inputs changed meanwhile', async () => {
    const resolvers: Record<string, (v: string) => void> = {};
    const { result, rerender } = renderHook(({ id }) => useAsync(() => new Promise<string>((resolve) => (resolvers[id] = resolve)), [id]), { initialProps: { id: 'a' } });
    rerender({ id: 'b' });
    await act(async () => resolvers.b('answer for b'));
    await act(async () => resolvers.a('late answer for a'));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('answer for b');
  });

  it('keeps the old data visible while reloading and reports errors', async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useAsync(async () => {
        calls++;
        if (calls === 3) throw new Error('offline');
        return calls;
      }, []),
    );
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => {
      void result.current.reload();
    });
    expect(result.current.data).toBe(1);
    await waitFor(() => expect(result.current.data).toBe(2));
    act(() => {
      void result.current.reload();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('offline');
  });
});
