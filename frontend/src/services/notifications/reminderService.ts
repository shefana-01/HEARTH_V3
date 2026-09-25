/**
 * Reminders — "tell me 15 minutes before".
 *
 * With the API, task-service raises reminders on a timer and they arrive as
 * ordinary notifications. MOCK: there is no server to keep time, so the app
 * checks while it is open (see `useReminders`) and raises them itself.
 */
import { config } from '../config';
import { actorId, db, notify, persist } from '../mockStore';
import { formatTime } from '@/lib/dates';

export interface DueReminder {
  id: string;
  title: string;
  message: string;
  href: string;
}

const MIN = 60_000;
export const TASK_LEAD_MIN = 15;
export const APPOINTMENT_LEAD_MIN = 60;

export const reminderService = {
  /**
   * Reminders that became due since the last check, for the signed-in person.
   * Each one is recorded as a notification and never raised twice.
   */
  collectDue(now: number = Date.now()): DueReminder[] {
    if (!config.useMocks || !db.account || !db.family) return [];
    const me = actorId();
    const due: DueReminder[] = [];
    const within = (start: string, leadMin: number) => {
      const t = new Date(start).getTime();
      return t > now && t - now <= leadMin * MIN;
    };

    for (const task of db.tasks) {
      const key = `task:${task.id}:${task.start}`;
      if (task.assigneeId !== me || !task.reminder || task.status !== 'scheduled' || db.reminded.includes(key) || !within(task.start, TASK_LEAD_MIN)) continue;
      db.reminded.push(key);
      due.push({ id: key, title: task.title, message: `Starts at ${formatTime(task.start)}.`, href: `/tasks/${task.id}` });
    }
    for (const appt of db.appointments) {
      const key = `appt:${appt.id}:${appt.start}`;
      if ((appt.forId !== me && appt.escortId !== me) || db.reminded.includes(key) || !within(appt.start, APPOINTMENT_LEAD_MIN)) continue;
      db.reminded.push(key);
      due.push({ id: key, title: appt.title, message: `Appointment at ${formatTime(appt.start)}${appt.location ? `, ${appt.location}` : ''}.`, href: `/appointments/${appt.id}` });
    }

    if (due.length) {
      for (const r of due) notify({ type: 'reminder', forId: me, message: `${r.title} — ${r.message.charAt(0).toLowerCase()}${r.message.slice(1)}`, href: r.href });
      persist();
    }
    return due;
  },
};
