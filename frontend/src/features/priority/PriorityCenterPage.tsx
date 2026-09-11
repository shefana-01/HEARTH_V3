import { PageHeader, Card } from '@/components/ui';

export default function PriorityCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Priority Center" description="Priority Center feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Priority Center is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
