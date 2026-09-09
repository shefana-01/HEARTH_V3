import { PageHeader, Card } from '@/components/ui';

export default function NutritionGoalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nutrition Goals" description="Nutrition Goals feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Nutrition Goals is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
