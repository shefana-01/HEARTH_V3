import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, ExternalLink, Network, TriangleAlert } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { activeStatus } from '@/components/domain/People';
import { careGraphService } from '@/services/care/careGraphService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/ui';
import { ROLES } from '@/constants/labels';
import { connectionLabel, encodeNodeId, NODE_META } from './graphMeta';
import type { CareGraph, GraphNode } from '@/types/domain';

type Fact = [label: string, value: string];

/** The plain facts about one item, taken from the family records. */
function useFacts(node: GraphNode, graph: CareGraph): Fact[] {
  const { family, memberById } = useFamily();
  const recordId = node.id.split(':')[1];
  const count = (kind: GraphNode['kind']) => graph.nodes.filter((n) => n.kind === kind).length;

  if (node.kind === 'family' && family) {
    return [
      ['Location', family.location || '—'],
      ['Members', String(count('member'))],
      ['People we look after', String(count('dependant'))],
      ['Tasks on the map', String(count('task'))],
      ['Appointments on the map', String(count('appointment'))],
    ];
  }
  if (node.kind === 'member') {
    const member = memberById(recordId);
    return member
      ? [
          ['Relation', member.relation || '—'],
          ['Role', ROLES[member.role].label],
          ['Status line', activeStatus(member) ?? 'None right now'],
        ]
      : [];
  }
  if (node.kind === 'dependant') {
    const dependant = family?.dependants.find((d) => d.id === recordId);
    return dependant
      ? [
          ['Relation', dependant.relation || '—'],
          ['Notes', dependant.notes || '—'],
        ]
      : [];
  }
  return [];
}

function ConnectionRow({ node, label }: { node: GraphNode; label: string }) {
  const meta = NODE_META[node.kind];
  return (
    <li>
      <Link to={`/caregraph/${encodeNodeId(node.id)}`} className="flex min-h-[2.75rem] items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-subtle">{label}</span>
          <span className="block truncate font-semibold text-ink">{node.label}</span>
          <span className="block truncate text-[0.8125rem] text-ink-muted">{node.sublabel}</span>
        </span>
        <span className={cn('hidden rounded-full px-2 py-0.5 text-2xs font-semibold sm:inline', meta.chip)}>{meta.label}</span>
        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
      </Link>
    </li>
  );
}

function EntityDetails({ node, graph }: { node: GraphNode; graph: CareGraph }) {
  const facts = useFacts(node, graph);
  const meta = NODE_META[node.kind];
  const Icon = meta.icon;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const connections = graph.edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .flatMap((edge) => {
      const other = byId.get(edge.from === node.id ? edge.to : edge.from);
      return other ? [{ edge, other }] : [];
    });
  const recordLink = node.href ?? (node.kind === 'family' ? '/family' : undefined);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Family map', to: '/caregraph' }, { label: node.label }]}
        title={node.label}
        description={`Everything directly connected to this ${meta.label.toLowerCase()}.`}
        actions={
          <ButtonLink to={`/caregraph?focus=${encodeNodeId(node.id)}`} variant="secondary" leftIcon={<Network aria-hidden="true" className="h-4 w-4" />}>
            Show on the map
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex items-start gap-4">
              <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', meta.chip)}>
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <Badge className="mb-1">{meta.label}</Badge>
                <h2 className="font-display text-2xl">{node.label}</h2>
                <p className="text-ink-muted">{node.sublabel}</p>
              </div>
            </div>
            {facts.length > 0 && (
              <dl className="mt-5 divide-y divide-line border-t border-line">
                {facts.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
                    <dt className="text-sm text-ink-subtle">{k}</dt>
                    <dd className="text-sm font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {node.flagged && (
              <Callout
                tone="red"
                className="mt-5"
                icon={<TriangleAlert aria-hidden="true" />}
                title="This task needs attention"
                action={
                  node.href && (
                    <ButtonLink to={`${node.href}/resolve`} size="sm">
                      Sort it out
                    </ButtonLink>
                  )
                }
              >
                There is a clash, or nobody is down to do it.
              </Callout>
            )}
          </Card>

          <Card>
            <CardHeader title="Connected to" description={connections.length ? plural(connections.length, 'direct connection') : undefined} />
            {connections.length ? (
              <ul className="space-y-2">
                {connections.map(({ edge, other }) => (
                  <ConnectionRow key={`${edge.from}-${edge.to}-${edge.label}`} node={other} label={connectionLabel(edge, node.id)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing is connected to this yet.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="eyebrow mb-3">Actions</p>
            <div className="flex flex-col gap-2">
              {recordLink && (
                <ButtonLink to={recordLink} leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
                  {meta.open}
                </ButtonLink>
              )}
              {(node.kind === 'task' || node.kind === 'appointment') && (
                <ButtonLink to="/schedule" variant="secondary" leftIcon={<CalendarDays aria-hidden="true" className="h-4 w-4" />}>
                  See it on the schedule
                </ButtonLink>
              )}
              {node.kind !== 'family' && (
                <ButtonLink to={`/caregraph/${encodeNodeId('family')}`} variant="ghost" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Back to the family
                </ButtonLink>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function EntityPage() {
  const { nodeId = '' } = useParams();
  const id = decodeURIComponent(nodeId);
  const graph = useAsync(() => careGraphService.getGraph(), []);
  const node = graph.data?.nodes.find((n) => n.id === id);
  useDocumentTitle(node?.label ?? 'Family map');

  if (graph.status === 'loading' && !graph.data) return <PageSkeleton />;
  if (graph.status === 'error') return <ErrorState headingLevel="h1" message={graph.error?.message} onRetry={graph.reload} />;
  if (!graph.data || !node) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<Network aria-hidden="true" />}
        title="That isn’t on the family map"
        description="It may be finished, cancelled, private or no longer in the family."
        action={<ButtonLink to="/caregraph">Back to the family map</ButtonLink>}
      />
    );
  }
  return <EntityDetails node={node} graph={graph.data} />;
}
