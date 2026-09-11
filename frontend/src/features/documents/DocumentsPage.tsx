import { PageHeader, Card } from '@/components/ui';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Document Vault" description="Document Vault feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Document Vault is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
