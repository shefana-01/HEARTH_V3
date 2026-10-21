package com.hearth.task.application;

import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.text.Formats;
import com.hearth.task.domain.Task;
import com.hearth.task.repository.TaskRepository;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Tell me 15 minutes before": once a minute, raises a reminder for every task that asked for one and
 * starts within the next 15 minutes. It arrives as a notification for the person doing the task, once.
 */
@Component
public class TaskReminders {

    private static final Logger log = LoggerFactory.getLogger(TaskReminders.class);
    static final Duration LEAD_TIME = Duration.ofMinutes(15);

    private final TaskRepository tasks;
    private final EventPublisher events;

    public TaskReminders(TaskRepository tasks, EventPublisher events) {
        this.tasks = tasks;
        this.events = events;
    }

    @Scheduled(fixedDelayString = "${hearth.reminders.poll-ms:60000}", initialDelayString = "PT20S")
    @Transactional
    public void raiseDueReminders() {
        Instant now = Instant.now();
        for (Task task : tasks.findDueReminders(now, now.plus(LEAD_TIME))) {
            task.setReminderSentAt(now);
            try {
                tasks.saveAndFlush(task);
            } catch (ObjectOptimisticLockingFailureException ex) {
                // Changed or reminded by another instance in the meantime; it will be looked at again.
                log.debug("Skipped reminder for task {}: {}", task.getId(), ex.getMessage());
                continue;
            }
            events.publish(Topics.TASK, Events.of(EventTypes.TASK_REMINDER, task.getFamilyId(), null)
                    .notifyMember(task.getAssigneeId(), "reminder", task.getTitle() + " — starts at " + Formats.time(task.getStartAt(), zone(task)) + ".", "/tasks/" + task.getId())
                    .data("taskId", task.getId())
                    .build());
        }
    }

    private static ZoneId zone(Task task) {
        try {
            return ZoneId.of(task.getTimezone());
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }
}
