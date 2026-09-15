import { PageHeader, Card } from '@/components/ui';

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Family Schedule" description="Family Schedule feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Family Schedule is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
