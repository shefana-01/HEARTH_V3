import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { authService } from '@/services/auth/authService';
import { isDemoMode } from '@/services/config';
import { appointmentService } from '@/services/care/appointmentService';
import { taskService } from '@/services/tasks/taskService';
import { useMutation } from '@/hooks/useAsync';
import { formatFullDate, formatTime, toDateInputValue } from '@/lib/dates';
import { downloadFile, toCsv } from '@/lib/download';
import { TASK_CATEGORIES } from '@/constants/labels';
import { Badge, Button, ButtonLink, Card, CardHeader, ConfirmDialog, useToast } from '@/components/ui';
import type { TaskStatus } from '@/types/domain';

const STATUS_LABELS: Record<TaskStatus, string> = { scheduled: 'Scheduled', completed: 'Done', cancelled: 'Cancelled' };
const when = (iso: string) => `${formatFullDate(iso)}, ${formatTime(iso)}`;

function ExportButton({ label, filename, build }: { label: string; filename: string; build: () => Promise<(string | number)[][]> }) {
  const { toast } = useToast();
  const exporting = useMutation(async () => downloadFile(`${filename}-${toDateInputValue()}.csv`, toCsv(await build()), 'text/csv;charset=utf-8'));
  const onClick = async () => {
    if (!(await exporting.attempt())) toast({ tone: 'error', title: 'Couldn’t prepare the file', description: 'Please try again.' });
  };
  return (
    <Button variant="secondary" size="sm" loading={exporting.pending} leftIcon={<FileSpreadsheet aria-hidden="true" className="h-4 w-4" />} onClick={onClick}>
      {label}
    </Button>
  );
}

function DownloadCard() {
  const { nameOf, personName } = useFamily();

  const tasks = async () => {
    const list = await taskService.listTasks({ includeCancelled: true });
    return [
      ['Task', 'Category', 'When', 'Who', 'For', 'Private', 'Status'],
      ...list.map((t) => [
        t.title,
        TASK_CATEGORIES[t.category].label,
        when(t.start),
        t.assigneeId ? nameOf(t.assigneeId) : 'Needs someone',
        t.forId ? personName(t.forId) : '',
        t.visibility === 'private' ? 'Yes' : 'No',
        STATUS_LABELS[t.status],
      ]),
    ];
  };

  const appointments = async () => {
    const list = await appointmentService.list();
    return [['Appointment', 'For', 'Going along', 'When', 'Where'], ...list.map((a) => [a.title, personName(a.forId), a.escortId ? nameOf(a.escortId) : '', when(a.start), a.location])];
  };

  return (
    <Card as="section" aria-labelledby="export-heading">
      <CardHeader
        title={<span id="export-heading">Download records</span>}
        icon={<Download aria-hidden="true" className="h-5 w-5" />}
        description="Spreadsheet files you can keep or share. They include only what you can see in Hearth."
      />
      <div className="flex flex-wrap gap-2">
        <ExportButton label="Tasks" filename="hearth-tasks" build={tasks} />
        <ExportButton label="Appointments" filename="hearth-appointments" build={appointments} />
        <ButtonLink to="/family" variant="secondary" size="sm">
          Family list
        </ButtonLink>
        <ButtonLink to="/activity" variant="secondary" size="sm">
          Activity history
        </ButtonLink>
      </div>
    </Card>
  );
}

export function DataSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation(authService.deleteLocalData);
  const isSample = Boolean(session?.isSample);

  const onDelete = async () => {
    if (await remove.attempt()) {
      await signOut();
      navigate('/');
    } else {
      setConfirm(false);
      toast({ tone: 'error', title: 'Couldn’t remove the data', description: 'Please try again.' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DownloadCard />
      <Card as="section" aria-labelledby="storage-heading" tone={isSample ? 'amber' : 'default'}>
        <CardHeader title={<span id="storage-heading">Where your data lives</span>} icon={<Database aria-hidden="true" className="h-5 w-5" />} />
        {isSample ? (
          <p className="text-sm text-ink">
            You’re exploring a <Badge tone="amber">Sample family</Badge>. Nothing here is real, and it’s cleared when you leave.
          </p>
        ) : isDemoMode ? (
          <p className="text-sm text-ink-muted">
            This demo keeps your account and family records in this browser only. They aren’t backed up or shared with other devices until Hearth’s servers are connected.
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Your account and family records are kept on Hearth’s servers, so your family sees the same plan on every device. This browser only remembers that you’re signed in.
          </p>
        )}
        {isDemoMode && (
          <Button className="mt-4" variant={isSample ? 'secondary' : 'danger-ghost'} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setConfirm(true)}>
            {isSample ? 'Leave the sample' : 'Delete data on this device'}
          </Button>
        )}
      </Card>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={onDelete}
        loading={remove.pending}
        variant={isSample ? 'primary' : 'danger'}
        title={isSample ? 'Leave the sample family?' : 'Delete everything on this device?'}
        description={
          isSample
            ? 'The sample data will be cleared. You can create your own account next.'
            : 'Your account, family, tasks, appointments and documents will be permanently removed from this browser. This can’t be undone.'
        }
        confirmLabel={isSample ? 'Leave sample' : 'Delete everything'}
      />
    </div>
  );
}
