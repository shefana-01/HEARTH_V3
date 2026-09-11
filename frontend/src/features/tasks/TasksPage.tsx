import { PageHeader, Card } from '@/components/ui';

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tasks Overview" description="Tasks Overview feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Tasks Overview is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
