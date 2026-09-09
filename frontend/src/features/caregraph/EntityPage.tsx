import { PageHeader, Card } from '@/components/ui';

export default function EntityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Care Entity Details" description="Care Entity Details feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Care Entity Details is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
