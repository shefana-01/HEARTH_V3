import { PageHeader, Card } from '@/components/ui';

export default function FamilyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Family Circle" description="Family Circle feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Family Circle is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
