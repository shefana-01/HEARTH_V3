import { PageHeader, Card } from '@/components/ui';

export default function CareGraphPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="CareGraph" description="CareGraph feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">CareGraph is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
