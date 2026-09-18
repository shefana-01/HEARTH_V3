import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, ExternalLink, Network, TriangleAlert } from 'lucide-react';
import { careGraphService } from '@/services/care/careGraphService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/ui';
import { encodeNodeId, NODE_META } from './graphMeta';

export default function EntityPage() {
  const { nodeId = '' } = useParams();
  const id = decodeURIComponent(nodeId);
  const graph = useAsync(() => careGraphService.getGraph(), []);
  const node = graph.data?.nodes.find((n) => n.id === id);
  useDocumentTitle(node?.label ?? 'CareGraph item');

  if (graph.status === 'loading' && !graph.data) return <PageSkeleton />;
  if (graph.status === 'error') return <ErrorState headingLevel="h1" message={graph.error?.message} onRetry={graph.reload} />;
  if (!node) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<Network aria-hidden="true" />}
        title="This item is no longer in the CareGraph"
        description="It may have been completed, cancelled or removed."
        action={<ButtonLink to="/caregraph">Back to CareGraph</ButtonLink>}
      />
    );
  }

  const byId = new Map(graph.data!.nodes.map((n) => [n.id, n]));
  const upstream = graph.data!.edges.filter((e) => e.to === id).map((e) => ({ edge: e, node: byId.get(e.from)! }));
  const downstream = graph.data!.edges.filter((e) => e.from === id).map((e) => ({ edge: e, node: byId.get(e.to)! }));
  const meta = NODE_META[node.kind];
  const Icon = meta.icon;

  const Row = ({ n, label, dir }: { n: (typeof upstream)[number]['node']; label: string; dir: 'up' | 'down' }) => {
    const m = NODE_META[n.kind];
    return (
      <li>
        <Link to={`/caregraph/${encodeNodeId(n.id)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
          <span className="text-ink-subtle">{dir === 'up' ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-subtle">{label}</span>
            <span className="block truncate font-semibold text-ink">{n.label}</span>
            <span className="block truncate text-[13px] text-ink-muted">{n.sublabel}</span>
          </span>
          <span className={`hidden rounded-full px-2 py-0.5 text-2xs font-semibold sm:inline ${m.chip}`}>{m.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'CareGraph', to: '/caregraph' }, { label: node.label }]}
        title="Focused entity"
        description="Everything directly connected to this item."
        actions={
          <ButtonLink to={`/caregraph?focus=${encodeNodeId(node.id)}`} variant="secondary" leftIcon={<Network aria-hidden="true" className="h-4 w-4" />}>
            Show on the graph
          </ButtonLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.chip}`}>
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <Badge className="mb-1">{meta.label}</Badge>
                <h2 className="font-display text-2xl">{node.label}</h2>
                <p className="text-ink-muted">{node.sublabel}</p>
              </div>
            </div>
            {node.flagged && (
              <Callout
                tone="red"
                className="mt-5"
                icon={<TriangleAlert aria-hidden="true" />}
                title="This task needs attention"
                action={
                  node.href && (
                    <ButtonLink to={`${node.href}/resolve`} size="sm">
                      Resolve
                    </ButtonLink>
                  )
                }
              >
                A conflict or missing owner was detected.
              </Callout>
            )}
          </Card>

          <Card>
            <CardHeader title="Depends on / comes from" description={`${upstream.length} upstream connection${upstream.length === 1 ? '' : 's'}`} />
            {upstream.length ? (
              <ul className="space-y-2">
                {upstream.map(({ edge, node: n }) => (
                  <Row key={n.id} n={n} label={edge.label} dir="up" />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing upstream — this is a starting point.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Leads to" description={`${downstream.length} downstream connection${downstream.length === 1 ? '' : 's'}`} />
            {downstream.length ? (
              <ul className="space-y-2">
                {downstream.map(({ edge, node: n }) => (
                  <Row key={n.id} n={n} label={edge.label} dir="down" />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing downstream yet.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="eyebrow mb-3">Actions</p>
            <div className="flex flex-col gap-2">
              {node.href && (
                <ButtonLink to={node.href} leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
                  Open the {meta.label.toLowerCase()}
                </ButtonLink>
              )}
              {(node.kind === 'task' || node.kind === 'appointment') && (
                <ButtonLink to="/schedule" variant="secondary" leftIcon={<CalendarDays aria-hidden="true" className="h-4 w-4" />}>
                  View in family schedule
                </ButtonLink>
              )}
              <ButtonLink to={`/caregraph/${encodeNodeId('recipient')}`} variant="ghost" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                Re-centre on the care recipient
              </ButtonLink>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
