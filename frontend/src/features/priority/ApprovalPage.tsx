import { PageHeader, Card } from '@/components/ui';

export default function ApprovalPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Task Approval" description="Task Approval feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Task Approval is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
