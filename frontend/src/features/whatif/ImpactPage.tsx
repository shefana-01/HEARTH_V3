import { PageHeader, Card } from '@/components/ui';

export default function ImpactPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Simulation Impact Analysis" description="Simulation Impact Analysis feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Simulation Impact Analysis is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
