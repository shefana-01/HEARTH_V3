import { PageHeader, Card } from '@/components/ui';

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Priority Recommendations" description="Priority Recommendations feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Priority Recommendations is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
