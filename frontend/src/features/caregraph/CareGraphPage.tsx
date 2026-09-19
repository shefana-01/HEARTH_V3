import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Minus, Network, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { careGraphService } from '@/services/care/careGraphService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';
import { Badge, ButtonLink, Card, EmptyState, ErrorState, IconButton, PageHeader, PageSkeleton, ToggleChip } from '@/components/ui';
import { encodeNodeId, NODE_META } from './graphMeta';
import type { GraphNode, GraphNodeKind } from '@/types/domain';

const FILTERS: (GraphNodeKind | 'all')[] = ['all', 'member', 'task', 'appointment', 'goal'];

export default function CareGraphPage() {
  useDocumentTitle('CareGraph');
  const [params, setParams] = useSearchParams();
  const graph = useAsync(() => careGraphService.getGraph(), []);
  const [filter, setFilter] = useState<GraphNodeKind | 'all'>('all');
  const [zoom, setZoom] = useState(1);
  const selectedId = params.get('focus');

  const nodes = useMemo(() => graph.data?.nodes ?? [], [graph.data]);
  const edges = graph.data?.edges ?? [];
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const visible = (n: GraphNode) => filter === 'all' || n.kind === filter || n.kind === 'recipient';
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const neighbours = new Set(selected ? edges.filter((e) => e.from === selected.id || e.to === selected.id).flatMap((e) => [e.from, e.to]) : []);
  const select = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('focus', id);
    else p.delete('focus');
    setParams(p, { replace: true });
  };

  if (graph.status === 'loading' && !graph.data) return <PageSkeleton />;
  if (graph.status === 'error') return <ErrorState headingLevel="h1" message={graph.error?.message} onRetry={graph.reload} />;

  const recipient = nodes.find((n) => n.kind === 'recipient');
  const flagged = nodes.filter((n) => n.flagged);

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="mint">Continuum of care</Badge>}
        title="CareGraph explorer"
        description={`How goals, appointments, tasks and people connect around ${recipient?.label ?? 'your loved one'}.`}
      />

      {nodes.length <= 1 ? (
        <EmptyState
          icon={<Network aria-hidden="true" />}
          title="Your CareGraph is still empty"
          description="Add tasks, appointments or nutrition goals and Hearth will map how they connect."
          action={
            <>
              <ButtonLink to="/tasks/new">Create a task</ButtonLink>
              <ButtonLink to="/nutrition" variant="secondary">
                Set nutrition goals
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <ToggleChip key={f} pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? `All (${nodes.length})` : NODE_META[f].plural}
                </ToggleChip>
              ))}
            </div>
            <div className="hidden items-center gap-1 rounded-xl border border-line bg-surface p-1 md:flex">
              <IconButton label="Zoom out" size="sm" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}>
                <Minus aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <span className="w-12 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <IconButton label="Zoom in" size="sm" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))}>
                <Plus aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Reset view" size="sm" onClick={() => setZoom(1)}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          {/* Graph canvas (tablet & desktop) */}
          <div className="relative hidden overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-muted via-surface to-primary-50/40 md:block">
            <p className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-ink-subtle shadow-card">Select any item to see its connections</p>
            <div className="relative mx-auto aspect-[16/10] w-full origin-center transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {edges.map((e) => {
                  const a = byId.get(e.from);
                  const b = byId.get(e.to);
                  if (!a || !b || !visible(a) || !visible(b)) return null;
                  const active = selected && (e.from === selected.id || e.to === selected.id);
                  return (
                    <line
                      key={`${e.from}-${e.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      vectorEffect="non-scaling-stroke"
                      className={cn(active ? 'stroke-primary-500' : b.flagged || a.flagged ? 'stroke-red-300' : 'stroke-line-strong')}
                      strokeWidth={active ? 2.5 : 1.5}
                      strokeDasharray={e.label === 'supported by' ? '4 4' : undefined}
                    />
                  );
                })}
              </svg>
              {nodes.filter(visible).map((n) => {
                const meta = NODE_META[n.kind];
                const Icon = meta.icon;
                const dim = selected && selected.id !== n.id && !neighbours.has(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => select(n.id === selectedId ? null : n.id)}
                    aria-pressed={n.id === selectedId}
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                    className={cn(
                      'absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 bg-surface p-2.5 text-left shadow-card transition-all hover:shadow-raised',
                      n.kind === 'recipient' && 'w-48 border-rose-300 bg-rose-50 p-3 shadow-raised',
                      n.flagged ? 'border-red-300' : meta.ring,
                      n.id === selectedId && 'ring-4 ring-primary-200',
                      dim && 'opacity-40',
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', meta.chip)}>
                      <Icon aria-hidden="true" className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="mt-1 block truncate text-[13px] font-semibold text-ink">{n.label}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">{n.sublabel}</span>
                    {n.flagged && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                        <TriangleAlert aria-hidden="true" className="h-3 w-3" /> Needs attention
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selected && (
              <Card className="absolute bottom-4 right-4 z-20 w-80 max-w-[calc(100%-2rem)] shadow-overlay" aria-live="polite">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">{NODE_META[selected.kind].label}</p>
                    <h2 className="font-display text-lg leading-snug">{selected.label}</h2>
                    <p className="text-[13px] text-ink-muted">{selected.sublabel}</p>
                  </div>
                  <IconButton label="Close details" size="sm" onClick={() => select(null)}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </div>
                <p className="mt-2 text-[13px] text-ink-subtle">{neighbours.size ? `${neighbours.size - 1} direct connection${neighbours.size === 2 ? '' : 's'}` : 'No connections yet'}</p>
                <ButtonLink to={`/caregraph/${encodeNodeId(selected.id)}`} size="sm" className="mt-3" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Open details
                </ButtonLink>
              </Card>
            )}
          </div>

          {/* List (phones) */}
          <div className="space-y-5 md:hidden">
            {(['task', 'appointment', 'goal', 'member'] as GraphNodeKind[]).map((kind) => {
              const list = nodes.filter((n) => n.kind === kind && visible(n));
              if (!list.length) return null;
              return (
                <section key={kind} aria-label={NODE_META[kind].plural}>
                  <h2 className="mb-2 font-display text-lg">{NODE_META[kind].plural}</h2>
                  <ul className="space-y-2">
                    {list.map((n) => (
                      <li key={n.id}>
                        <Link
                          to={`/caregraph/${encodeNodeId(n.id)}`}
                          className={cn('flex items-center justify-between gap-3 rounded-2xl border bg-surface p-3', n.flagged ? 'border-red-200' : 'border-line')}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{n.label}</span>
                            <span className="block truncate text-[13px] text-ink-subtle">{n.sublabel}</span>
                          </span>
                          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <Card tone="muted" padding="sm" className="mt-4 flex flex-col gap-2 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {nodes.filter(visible).length} of {nodes.length} items · {edges.length} connections
            </span>
            {flagged.length > 0 && (
              <Link to="/priority" className="inline-flex items-center gap-1.5 font-semibold text-red-600 hover:underline">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" /> {flagged.length} item{flagged.length === 1 ? '' : 's'} need attention
              </Link>
            )}
          </Card>
        </>
      )}
    </>
  );
}
