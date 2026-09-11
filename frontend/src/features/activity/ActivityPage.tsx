import { PageHeader, Card } from '@/components/ui';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Activity & Audit Log" description="Activity & Audit Log feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Activity & Audit Log is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
