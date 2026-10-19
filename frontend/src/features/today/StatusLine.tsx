import { useState, type FormEvent } from 'react';
import { Clock, MessageCircle } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { familyService } from '@/services/family/familyService';
import { useMutation } from '@/hooks/useAsync';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { STATUS_SUGGESTIONS } from '@/constants/labels';
import { Button, Card, Dialog, FormError, FormField, Input, ToggleChip, useToast } from '@/components/ui';
import { activeStatus } from '@/components/domain/People';

const MAX_STATUS = 80;

function StatusDialog({ current, onClose }: { current: string | null; onClose: () => void }) {
  const { refresh } = useFamily();
  const { toast } = useToast();
  const [text, setText] = useState(current ?? '');
  const [until, setUntil] = useState('');
  const [untilError, setUntilError] = useState<string>();
  const save = useMutation((value: string, untilIso?: string) => familyService.setStatus(value, untilIso));

  const finish = async (value: string, untilIso: string | undefined, title: string) => {
    const member = await save.run(value, untilIso);
    if (!member) return;
    await refresh();
    toast({ title });
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const untilIso = until ? combineDateTime(toDateInputValue(), until) : undefined;
    if (untilIso && new Date(untilIso).getTime() <= Date.now()) {
      setUntilError('Choose a time later today, or leave this empty.');
      return;
    }
    setUntilError(undefined);
    void finish(text, untilIso, 'Status updated');
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Your status"
      description="Your family sees this next to your name."
      dismissible={!save.pending}
      footer={
        <>
          {current && (
            <Button variant="ghost" disabled={save.pending} onClick={() => void finish('', undefined, 'Status cleared')}>
              Clear status
            </Button>
          )}
          <Button type="submit" form="status-form" loading={save.pending} disabled={!text.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form id="status-form" onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={save.error} />
        <FormField label="What are you up to?" aside={`${text.length}/${MAX_STATUS}`}>
          {(p) => <Input {...p} value={text} maxLength={MAX_STATUS} onChange={(e) => setText(e.target.value)} placeholder="e.g. In class until 2" />}
        </FormField>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Quick picks</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_SUGGESTIONS.map((s) => (
              <ToggleChip key={s} pressed={text === s} onClick={() => setText(s)}>
                {s}
              </ToggleChip>
            ))}
          </div>
        </div>
        <FormField label="Until" aside="Optional" hint="It clears itself at this time today." error={untilError}>
          {(p) => <Input {...p} type="time" leftIcon={<Clock />} value={until} onChange={(e) => setUntil(e.target.value)} />}
        </FormField>
      </form>
    </Dialog>
  );
}

/** The signed-in person's status line, with a button to change it. */
export function StatusLine() {
  const { me } = useFamily();
  const [open, setOpen] = useState(false);
  const status = activeStatus(me);

  return (
    <>
      <Card padding="sm" tone="muted" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <MessageCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div className="min-w-0">
            <p className="text-sm text-ink">
              <span className="font-semibold">Your status: </span>
              {status ? <span>{status}</span> : <span className="text-ink-muted">Nothing set</span>}
            </p>
            <p className="text-[0.8125rem] text-ink-subtle">Your family sees this next to your name.</p>
          </div>
        </div>
        <Button variant="secondary" className="min-h-11 shrink-0" onClick={() => setOpen(true)}>
          {status ? 'Change' : 'Set status'}
        </Button>
      </Card>
      {open && <StatusDialog current={status} onClose={() => setOpen(false)} />}
    </>
  );
}
