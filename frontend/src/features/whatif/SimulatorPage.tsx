import { PageHeader, Card } from '@/components/ui';

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="What-If Simulation" description="What-If Simulation feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">What-If Simulation is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
