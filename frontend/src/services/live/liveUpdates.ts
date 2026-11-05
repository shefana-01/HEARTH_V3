/**
 * Live updates: when someone in the family changes something, open pages refresh by themselves.
 *
 * With the backend, notification-service streams small "this part changed" messages (server-sent events)
 * and the page reloads through the normal API, so every visibility rule still applies. In demo mode, other
 * tabs of the same browser are told through the `storage` event when the shared workspace changes.
 *
 * Pages subscribe with `useLiveRefresh(['tasks'], reload)`.
 */
import { config } from '../config';
import { openStream } from '../api/client';
import { SseParser } from './sse';
import { reloadWorkspace } from '../mockStore';

export type LiveScope = 'tasks' | 'plan' | 'care' | 'family' | 'notifications' | 'chat';
export const ALL_SCOPES: LiveScope[] = ['tasks', 'plan', 'care', 'family', 'notifications', 'chat'];

export const LIVE_EVENT = 'hearth:live';
export type LiveStatus = 'off' | 'connecting' | 'live' | 'retrying';

const STATUS_EVENT = 'hearth:live-status';
let status: LiveStatus = 'off';

function setStatus(next: LiveStatus) {
  status = next;
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: next }));
}

export function liveStatus(): LiveStatus {
  return status;
}

export function onLiveStatus(listener: (s: LiveStatus) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<LiveStatus>).detail);
  window.addEventListener(STATUS_EVENT, handler);
  return () => window.removeEventListener(STATUS_EVENT, handler);
}

export function announce(scopes: LiveScope[]) {
  if (scopes.length) window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: scopes }));
}

const MAX_BACKOFF_MS = 30_000;

/** Connects and keeps reconnecting until `stop()` is called. Returns `stop`. */
export function startLiveUpdates(): () => void {
  if (config.useMocks) return startDemoSync();

  let stopped = false;
  let controller: AbortController | null = null;
  let attempt = 0;
  let timer: number | undefined;

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    setStatus(attempt === 0 ? 'connecting' : 'retrying');
    try {
      const response = await openStream('/notifications/stream', controller.signal);
      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
      setStatus('live');
      // Anything may have changed while we were away.
      if (attempt > 0) announce(ALL_SCOPES);
      attempt = 0;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = new SseParser();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const event of parser.push(value)) {
          if (event.event !== 'change') continue;
          try {
            const { scopes } = JSON.parse(event.data) as { scopes: LiveScope[] };
            announce(scopes.filter((s) => ALL_SCOPES.includes(s)));
          } catch {
            /* ignore a malformed message */
          }
        }
      }
    } catch {
      if (stopped) return;
    }
    if (stopped) return;
    attempt++;
    // Exponential backoff with jitter: 1s, 2s, 4s … up to 30s.
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempt - 1, 5)) * (0.75 + Math.random() * 0.5);
    setStatus('retrying');
    timer = window.setTimeout(() => void connect(), delay);
  };

  const onOnline = () => {
    if (status !== 'live') {
      window.clearTimeout(timer);
      controller?.abort();
      void connect();
    }
  };
  window.addEventListener('online', onOnline);
  void connect();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    controller?.abort();
    setStatus('off');
  };
}

/** Demo: another tab saved the workspace, so everything here may be out of date. */
function startDemoSync(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== 'hearth.workspace.v3') return;
    reloadWorkspace();
    announce(ALL_SCOPES);
  };
  window.addEventListener('storage', onStorage);
  setStatus('live');
  return () => {
    window.removeEventListener('storage', onStorage);
    setStatus('off');
  };
}
