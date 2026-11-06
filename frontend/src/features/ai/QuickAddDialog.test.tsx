import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import type { TaskInput } from '@/types/domain';

const created: TaskInput[] = [];
vi.mock('@/services/tasks/taskService', () => ({
  taskService: { createTask: vi.fn(async (input: TaskInput) => (created.push(input), { ...input, id: `t${created.length}` })) },
}));
vi.mock('./useAiStatus', () => ({ useAiStatus: () => ({ status: undefined, mode: 'basic', refresh: vi.fn(), setConsent: vi.fn() }) }));
vi.mock('@/app/FamilyProvider', () => {
  const members = [
    { id: 'a', name: 'Afsara Mannan', role: 'lead', status: 'active' },
    { id: 'r', name: 'Rafid Mannan', role: 'contributor', status: 'active' },
  ];
  return {
    useFamily: () => ({
      members,
      me: members[0],
      people: [
        { id: 'a', kind: 'member', name: 'Afsara Mannan', relation: '' },
        { id: 'r', kind: 'member', name: 'Rafid Mannan', relation: '' },
        { id: 'g', kind: 'dependant', name: 'Rahima Khatun', relation: 'Grandmother' },
      ],
    }),
  };
});

const { QuickAddDialog } = await import('./QuickAddDialog');

describe('Quick add', () => {
  it('turns a note into editable drafts and saves only the ticked ones', async () => {
    // jsdom has no <dialog> methods.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <ToastProvider>
        <QuickAddDialog open onClose={vi.fn()} onSaved={onSaved} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText(/What needs doing/), 'Buy rice tomorrow 6pm{enter}Rafid takes Rahima to the dentist Saturday at 4:30{enter}Call the bank');
    await user.click(screen.getByRole('button', { name: /Make drafts/ }));

    const titles = (await screen.findAllByLabelText('Task', { exact: true })) as HTMLInputElement[];
    expect(titles.map((t) => t.value)).toEqual(['Buy rice', 'Take Rahima to the dentist', 'Call the bank']);
    expect(screen.getByText(/No time was given for “Call the bank”/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Save task 3' }));
    await user.clear(titles[0]);
    await user.type(titles[0], 'Buy rice and lentils');
    await user.click(screen.getByRole('button', { name: /Save tasks \(2\)/ }));

    expect(created.map((t) => t.title)).toEqual(['Buy rice and lentils', 'Take Rahima to the dentist']);
    expect(created[1]).toMatchObject({ assigneeId: 'r', forId: 'g', category: 'health' });
    expect(onSaved).toHaveBeenCalledWith(2);
  }, 15000);
});
