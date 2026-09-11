import { PageHeader, Card } from '@/components/ui';

export default function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" description="Appointments feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Appointments is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
