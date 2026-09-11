import { PageHeader, Card } from '@/components/ui';

export default function FoodRecommendationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Food Recommendations" description="Food Recommendations feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Food Recommendations is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
