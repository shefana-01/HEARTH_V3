import { PageHeader, Card } from '@/components/ui';

export default function TaskFormPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Task Details" description="Task Details feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Task Details is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
