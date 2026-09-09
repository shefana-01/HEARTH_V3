import { PageHeader, Card } from '@/components/ui';

export default function MemberPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Family Member Profile" description="Family Member Profile feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Family Member Profile is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
