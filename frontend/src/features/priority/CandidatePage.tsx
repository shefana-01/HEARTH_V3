import { PageHeader, Card } from '@/components/ui';

export default function CandidatePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Candidate Suitability" description="Candidate Suitability feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Candidate Suitability is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
