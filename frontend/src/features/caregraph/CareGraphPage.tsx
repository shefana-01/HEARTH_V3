import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Minus, Network, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { careGraphService } from '@/services/care/careGraphService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ButtonLink, Card, EmptyState, ErrorState, IconButton, PageHeader, PageSkeleton, ToggleChip } from '@/components/ui';
import { encodeNodeId, isCore, isStructural, NODE_META } from './graphMeta';
import type { GraphNode, GraphNodeKind } from '@/types/domain';

type Filter = 'all' | 'task' | 'appointment' | 'people';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'task', label: 'Tasks' },
  { value: 'appointment', label: 'Appointments' },
  { value: 'people', label: 'People only' },
];

const LIST_ORDER: GraphNodeKind[] = ['member', 'dependant', 'task', 'appointment'];
const LEGEND: GraphNodeKind[] = ['family', 'member', 'dependant', 'task', 'appointment'];

export default function CareGraphPage() {
  useDocumentTitle('Family map');
  const [params, setParams] = useSearchParams();
  const graph = useAsync(() => careGraphService.getGraph(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [zoom, setZoom] = useState(1);
  const selectedId = params.get('focus');

  const nodes = useMemo(() => graph.data?.nodes ?? [], [graph.data]);
  const edges = graph.data?.edges ?? [];
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const visible = (n: GraphNode) => isCore(n) || filter === 'all' || n.kind === filter;
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

  const flagged = nodes.filter((n) => n.flagged);
  const shown = nodes.filter(visible);

  return (
    <>
      <PageHeader title="Family map" description="Who is doing what, and for whom." />

      {nodes.length <= 1 ? (
        <EmptyState
          icon={<Network aria-hidden="true" />}
          title="Your family map is still empty"
          description="Add shared tasks or appointments and Hearth will show who is doing what, and for whom."
          action={
            <>
              <ButtonLink to="/tasks/new">Add a task</ButtonLink>
              <ButtonLink to="/appointments/new" variant="secondary">
                Add an appointment
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <ToggleChip key={f.value} pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                  {f.label}
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
            <p className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-ink-subtle shadow-card">
              Select anything to see what it is connected to
            </p>
            <div className="relative mx-auto aspect-[16/10] w-full origin-center transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {edges.map((e) => {
                  const a = byId.get(e.from);
                  const b = byId.get(e.to);
                  if (!a || !b || !visible(a) || !visible(b)) return null;
                  const active = selected && (e.from === selected.id || e.to === selected.id);
                  const quiet = isStructural(e) && !active;
                  return (
                    <line
                      key={`${e.from}-${e.to}-${e.label}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      vectorEffect="non-scaling-stroke"
                      className={cn(active ? 'stroke-primary-500' : quiet ? 'stroke-line' : b.flagged || a.flagged ? 'stroke-red-300' : 'stroke-line-strong')}
                      strokeWidth={active ? 2.5 : quiet ? 1 : 1.5}
                      strokeDasharray={quiet ? '3 5' : undefined}
                    />
                  );
                })}
              </svg>
              {shown.map((n) => {
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
                      n.kind === 'family' && 'w-48 bg-primary-50 p-3 shadow-raised',
                      n.flagged ? 'border-red-300' : meta.ring,
                      n.id === selectedId && 'ring-4 ring-primary-200',
                      dim && 'opacity-40',
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide', meta.chip)}>
                      <Icon aria-hidden="true" className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="mt-1 block truncate text-[0.8125rem] font-semibold text-ink">{n.label}</span>
                    <span className="block truncate text-[0.6875rem] text-ink-subtle">{n.sublabel}</span>
                    {n.flagged && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[0.625rem] font-semibold text-red-600">
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
                    <p className="text-[0.8125rem] text-ink-muted">{selected.sublabel}</p>
                  </div>
                  <IconButton label="Close details" size="sm" onClick={() => select(null)}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </div>
                <p className="mt-2 text-[0.8125rem] text-ink-subtle">{neighbours.size > 1 ? `Connected to ${plural(neighbours.size - 1, 'other item')}` : 'Not connected to anything else yet'}</p>
                <ButtonLink to={`/caregraph/${encodeNodeId(selected.id)}`} size="sm" className="mt-3" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Open details
                </ButtonLink>
              </Card>
            )}
          </div>

          {/* List (phones) */}
          <div className="space-y-5 md:hidden">
            {LIST_ORDER.map((kind) => {
              const list = shown.filter((n) => n.kind === kind);
              if (!list.length) return null;
              return (
                <section key={kind} aria-label={NODE_META[kind].plural}>
                  <h2 className="mb-2 font-display text-lg">{NODE_META[kind].plural}</h2>
                  <ul className="space-y-2">
                    {list.map((n) => (
                      <li key={n.id}>
                        <Link
                          to={`/caregraph/${encodeNodeId(n.id)}`}
                          className={cn('flex min-h-[2.75rem] items-center justify-between gap-3 rounded-2xl border bg-surface p-3', n.flagged ? 'border-red-200' : 'border-line')}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{n.label}</span>
                            <span className="block truncate text-[0.8125rem] text-ink-subtle">{n.sublabel}</span>
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

          <ul aria-label="Key" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
            {LEGEND.map((kind) => {
              const { icon: Icon, chip, label } = NODE_META[kind];
              return (
                <li key={kind} className="inline-flex items-center gap-1.5">
                  <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', chip)}>
                    <Icon aria-hidden="true" className="h-3 w-3" />
                  </span>
                  {label}
                </li>
              );
            })}
            <li className="text-ink-subtle">Faint dotted lines show who belongs to the family.</li>
          </ul>

          <Card tone="muted" padding="sm" className="mt-4 flex flex-col gap-2 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {shown.length} of {nodes.length} items · {plural(edges.length, 'connection')} · Private tasks and appointments are never shown here.
            </span>
            {flagged.length > 0 && (
              <Link to="/priority" className="inline-flex items-center gap-1.5 font-semibold text-red-600 hover:underline">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" /> {plural(flagged.length, 'task')} need{flagged.length === 1 ? 's' : ''} attention
              </Link>
            )}
          </Card>
        </>
      )}
    </>
  );
}
