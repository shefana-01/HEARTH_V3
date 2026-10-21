package com.hearth.task.application;

import com.hearth.task.domain.PersonalEvent;
import com.hearth.task.domain.Task;
import com.hearth.task.domain.Unavailability;
import com.hearth.task.dto.TaskDtos.EventView;
import com.hearth.task.dto.TaskDtos.TaskView;
import com.hearth.task.dto.TaskDtos.UnavailabilityView;
import java.util.List;
import java.util.UUID;

/** Turns stored records into the shapes the browser and decision-service expect. */
final class TaskViews {

    private TaskViews() {
    }

    static TaskView view(Task task) {
        return new TaskView(
                task.getId(), task.getTitle(), task.getNotes(), task.getCategory(), task.getPriority(), task.getStatus(), task.getStartAt(), task.getDurationMin(),
                task.getAssigneeId(), task.getForId(), task.getVisibility(), task.getCreatedById(), task.getCreatedAt(), task.getAppointmentId(),
                task.getCompletedAt(), task.getCompletedById(), task.isReminder(), task.getAcknowledgedConflict());
    }

    /** What someone who may not see a private task learns about it: who is busy and when, nothing more. */
    static TaskView masked(Task task) {
        return new TaskView(
                task.getId(), "", "", "other", task.getPriority(), task.getStatus(), task.getStartAt(), task.getDurationMin(),
                task.getAssigneeId(), null, task.getVisibility(), task.getCreatedById(), task.getCreatedAt(), null,
                null, null, false, null);
    }

    static EventView view(PersonalEvent event) {
        return new EventView(
                event.getId(), event.getMemberId(), event.getTitle(), event.getKind(), event.getStartAt(), event.getDurationMin(), event.getRepeat(),
                List.copyOf(event.getDays()), event.getUntilAt(), event.getLocation(), event.getVisibility(), event.getCreatedAt());
    }

    /** What the rest of the family sees of someone's event: the details, or only that the time is taken. */
    static EventView forViewer(PersonalEvent event, UUID viewer) {
        if (event.getMemberId().equals(viewer) || !event.isHidden()) {
            return view(event);
        }
        return new EventView(
                event.getId(), event.getMemberId(), "Busy", event.getKind(), event.getStartAt(), event.getDurationMin(), event.getRepeat(),
                List.copyOf(event.getDays()), event.getUntilAt(), "", event.getVisibility(), event.getCreatedAt());
    }

    static UnavailabilityView view(Unavailability away) {
        return new UnavailabilityView(away.getId(), away.getMemberId(), away.getStartAt(), away.getEndAt(), away.getReason(), away.getNote(), away.getCreatedAt());
    }
}
