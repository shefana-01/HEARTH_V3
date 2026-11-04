import { useMemo, useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type QuickAddResult, type TaskDraft } from '@/services/ai/aiService';
import type { RosterPerson } from '@/services/ai/localAssistant';
import { taskService } from '@/services/tasks/taskService';
import { TASK_CATEGORIES, PRIORITIES } from '@/constants/labels';
import { useTranslation } from '@/i18n';
import { Button, Callout, Checkbox, Dialog, FormError, FormField, Input, Select, Textarea, useToast } from '@/components/ui';
import type { TaskCategory, TaskPriority } from '@/types/domain';
import { AiBadge } from './AiBadge';
import { AiConsentCallout } from './AiConsentCallout';
import { useAiStatus } from './useAiStatus';

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Row extends TaskDraft {
  key: string;
  include: boolean;
}

/**
 * "Write it like you'd say it": a note becomes task drafts, each editable, saved only when the person says so.
 * Every draft is saved through task-service, so all the normal rules (who may see it, reminders, the
 * activity log) apply exactly as for the task form.
 */
export function QuickAddDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: (count: number) => void }) {
  const { members, me, people } = useFamily();
  const { mode, refresh } = useAiStatus();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [pending, setPending] = useState<'draft' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const takers = useMemo(() => members.filter((m) => m.status === 'active' && m.role !== 'observer'), [members]);
  const roster: RosterPerson[] = useMemo(() => people.map((p) => ({ id: p.id, name: p.name, kind: p.kind, takesTasks: p.kind === 'member' && takers.some((m) => m.id === p.id) })), [people, takers]);

  const reset = () => {
    setNote('');
    setRows(null);
    setAssumptions([]);
    setError(null);
  };
  const close = () => {
    if (pending) return;
    reset();
    onClose();
  };

  const makeDrafts = async () => {
    if (!me) return;
    setPending('draft');
    setError(null);
    try {
      const self: RosterPerson = { id: me.id, name: me.name, kind: 'member', takesTasks: me.role !== 'observer' };
      const result: QuickAddResult = await aiService.quickAdd(note, mode, roster, self);
      if (result.drafts.length === 0) {
        setError('No tasks were found in that note. Try one task per line, with a day and time.');
        return;
      }
      setRows(result.drafts.map((d, i) => ({ ...d, key: `${i}-${d.title}`, include: true })));
      setAssumptions(result.assumptions);
      if (mode === 'ai') void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(null);
    }
  };

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  const save = async () => {
    const chosen = rows?.filter((r) => r.include) ?? [];
    if (chosen.length === 0) return setError('Tick at least one task to save.');
    if (chosen.some((r) => !r.title.trim())) return setError('Every task needs a name.');
    setPending('save');
    setError(null);
    let saved = 0;
    try {
      for (const row of chosen) {
        await taskService.createTask({
          title: row.title.trim(),
          notes: row.notes ?? '',
          category: row.category,
          priority: row.priority,
          start: row.start,
          durationMin: row.durationMin,
          assigneeId: row.visibility === 'private' ? (me?.id ?? null) : row.assigneeId,
          forId: row.forId,
          visibility: row.visibility,
          reminder: row.reminder,
        });
        saved++;
        setRows((prev) => prev?.filter((r) => r.key !== row.key) ?? null);
      }
      toast({ title: saved === 1 ? 'Task added' : `${saved} tasks added` });
      onSaved?.(saved);
      reset();
      onClose();
    } catch (e) {
      setError(`${saved > 0 ? `${saved} saved. ` : ''}${e instanceof Error ? e.message : 'A task couldn’t be saved.'}`);
    } finally {
      setPending(null);
    }
  };

  const chosenCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!pending}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          {t.ai.quickAddTitle} <AiBadge mode={mode} />
        </span>
      }
      description={rows ? t.ai.draftsHeading : t.ai.quickAddHelp}
      footer={
        rows ? (
          <>
            <Button variant="secondary" onClick={() => setRows(null)} disabled={Boolean(pending)}>
              Back to the note
            </Button>
            <Button onClick={() => void save()} loading={pending === 'save'} disabled={chosenCount === 0}>
              {t.ai.saveDrafts} ({chosenCount})
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={Boolean(pending)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void makeDrafts()} loading={pending === 'draft'} disabled={!note.trim()} leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}>
              {t.ai.makeDrafts}
            </Button>
          </>
        )
      }
    >
      {!rows ? (
        <div className="space-y-4">
          <AiConsentCallout compact />
          <FormField label="What needs doing?" hint={`${note.length}/600`}>
            {(field) => <Textarea {...field} voice rows={5} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.ai.quickAddPlaceholder} />}
          </FormField>
          <FormError message={error} />
        </div>
      ) : (
        <div className="space-y-4">
          {assumptions.length > 0 && (
            <Callout tone="amber" icon={<Lightbulb aria-hidden="true" />} title="Worth checking">
              <ul className="list-disc space-y-0.5 pl-4">
                {assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Callout>
          )}
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="rounded-2xl border border-line p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Checkbox checked={row.include} onChange={(e) => update(row.key, { include: e.target.checked })} label={`Save task ${index + 1}`} />
                  {row.forId && <span className="text-xs text-ink-muted">For {people.find((p) => p.id === row.forId)?.name.split(' ')[0] ?? 'someone'}</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Task" className="sm:col-span-2">
                    {(field) => <Input {...field} value={row.title} maxLength={120} onChange={(e) => update(row.key, { title: e.target.value })} />}
                  </FormField>
                  <FormField label="When">
                    {(field) => (
                      <Input {...field} type="datetime-local" value={toLocalInput(row.start)} onChange={(e) => e.target.value && update(row.key, { start: new Date(e.target.value).toISOString() })} />
                    )}
                  </FormField>
                  <FormField label="Minutes">
                    {(field) => (
                      <Input
                        {...field}
                        type="number"
                        min={5}
                        max={1440}
                        step={5}
                        value={row.durationMin}
                        onChange={(e) => update(row.key, { durationMin: Math.max(5, Math.min(1440, Number(e.target.value) || 30)) })}
                      />
                    )}
                  </FormField>
                  <FormField label="Who does it">
                    {(field) => (
                      <Select {...field} value={row.assigneeId ?? ''} disabled={row.visibility === 'private'} onChange={(e) => update(row.key, { assigneeId: e.target.value || null })}>
                        <option value="">Nobody yet</option>
                        {takers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id === me?.id ? `${m.name} (me)` : m.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Kind">
                    {(field) => (
                      <Select {...field} value={row.category} onChange={(e) => update(row.key, { category: e.target.value as TaskCategory })}>
                        {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map((c) => (
                          <option key={c} value={c}>
                            {TASK_CATEGORIES[c].label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Importance">
                    {(field) => (
                      <Select {...field} value={row.priority} onChange={(e) => update(row.key, { priority: e.target.value as TaskPriority })}>
                        {(Object.keys(PRIORITIES) as TaskPriority[]).map((p) => (
                          <option key={p} value={p}>
                            {PRIORITIES[p].label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Who can see it">
                    {(field) => (
                      <Select
                        {...field}
                        value={row.visibility}
                        onChange={(e) => {
                          const visibility = e.target.value as Row['visibility'];
                          update(row.key, visibility === 'private' ? { visibility, assigneeId: me?.id ?? null } : { visibility });
                        }}
                      >
                        <option value="family">The family</option>
                        <option value="private">Only me</option>
                      </Select>
                    )}
                  </FormField>
                </div>
                <div className="mt-3">
                  <Checkbox checked={row.reminder} onChange={(e) => update(row.key, { reminder: e.target.checked })} label="Remind me 15 minutes before" />
                </div>
              </li>
            ))}
          </ul>
          <FormError message={error} />
        </div>
      )}
    </Dialog>
  );
}
