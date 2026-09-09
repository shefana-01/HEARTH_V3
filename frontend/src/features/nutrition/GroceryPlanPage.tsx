import { PageHeader, Card } from '@/components/ui';

export default function GroceryPlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Grocery Plan" description="Grocery Plan feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Grocery Plan is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
