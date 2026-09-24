import { useEffect } from 'react';
import { useToast } from '@/components/ui';
import { reminderService } from '@/services/notifications/reminderService';
import { notificationService } from '@/services/notifications/notificationService';

const CHECK_EVERY_MS = 30_000;

/**
 * While the app is open in demo mode, look for reminders that have come due
 * and show them. With the backend, reminders are raised by the server and
 * arrive as notifications, so this finds nothing.
 */
export function useReminders(): void {
  const { toast } = useToast();

  useEffect(() => {
    const check = () => {
      const due = reminderService.collectDue();
      for (const reminder of due) {
        toast({ tone: 'info', title: `Reminder: ${reminder.title}`, description: reminder.message });
      }
      if (due.length) notificationService.refresh();
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [toast]);
}
