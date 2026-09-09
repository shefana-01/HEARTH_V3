import { PageHeader, Card } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Dashboard feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Dashboard is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
