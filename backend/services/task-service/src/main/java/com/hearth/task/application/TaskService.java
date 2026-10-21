package com.hearth.task.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.Names;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import com.hearth.task.domain.Task;
import com.hearth.task.dto.TaskDtos.PlanChange;
import com.hearth.task.dto.TaskDtos.TaskInput;
import com.hearth.task.dto.TaskDtos.TaskView;
import com.hearth.task.repository.TaskRepository;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tasks. A private task is only ever returned to its owner (and whoever wrote it down); to anyone else it
 * is "not found". Private tasks leave no trace in the family's activity log or notifications.
 */
@Service
public class TaskService {

    private final FamilyDirectory directory;
    private final TaskRepository tasks;
    private final EventPublisher events;

    public TaskService(FamilyDirectory directory, TaskRepository tasks, EventPublisher events) {
        this.directory = directory;
        this.tasks = tasks;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<TaskView> list(UUID assigneeId, boolean includeCancelled) {
        FamilyContext context = directory.context();
        return tasks.findByFamilyIdOrderByStartAtAscIdAsc(context.familyId()).stream()
                .filter(task -> task.isVisibleTo(context.memberId()))
                .filter(task -> includeCancelled || !Task.CANCELLED.equals(task.getStatus()))
                .filter(task -> assigneeId == null || assigneeId.equals(task.getAssigneeId()))
                .map(TaskViews::view)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskView get(UUID id) {
        FamilyContext context = directory.context();
        return TaskViews.view(find(context, id));
    }

    @Transactional
    public TaskView create(TaskInput input) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = new Task(context.familyId(), context.memberId());
        apply(task, input, context);
        tasks.save(task);

        Events event = describe(Events.of(EventTypes.TASK_CREATED, context), task);
        if (task.isShared()) {
            event.audit("tasks", "Created a task", task.getTitle(), null, summary(task, context));
            askToDo(event, context, task);
        }
        events.publish(Topics.TASK, event.build());
        return TaskViews.view(task);
    }

    @Transactional
    public TaskView update(UUID id, TaskInput input) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        String before = summary(task, context);
        UUID previousAssignee = task.getAssigneeId();
        boolean wasShared = task.isShared();
        apply(task, input, context);
        // The plan changed, so a clash someone chose to keep has to be looked at again.
        task.setAcknowledgedConflict(null);
        tasks.save(task);

        Events event = describe(Events.of(task.isShared() || !wasShared ? EventTypes.TASK_UPDATED : EventTypes.TASK_MADE_PRIVATE, context), task);
        if (task.isShared()) {
            event.audit("tasks", "Edited a task", task.getTitle(), before, summary(task, context));
            if (!Objects.equals(previousAssignee, task.getAssigneeId())) {
                askToDo(event, context, task);
            }
        }
        events.publish(Topics.TASK, event.build());
        return TaskViews.view(task);
    }

    @Transactional
    public TaskView complete(UUID id) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        task.complete(context.memberId());
        tasks.save(task);
        Events event = describe(Events.of(EventTypes.TASK_COMPLETED, context), task);
        if (task.isShared()) {
            event.audit("tasks", "Completed a task", task.getTitle());
        }
        events.publish(Topics.TASK, event.build());
        return TaskViews.view(task);
    }

    @Transactional
    public TaskView reopen(UUID id) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        task.reopen();
        tasks.save(task);
        Events event = describe(Events.of(EventTypes.TASK_REOPENED, context), task);
        if (task.isShared()) {
            event.audit("tasks", "Reopened a task", task.getTitle());
        }
        events.publish(Topics.TASK, event.build());
        return TaskViews.view(task);
    }

    /** Cancelled, not deleted: it stays in the history. Open handover requests for it are closed. */
    @Transactional
    public void cancel(UUID id) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        task.cancel();
        tasks.save(task);
        Events event = describe(Events.of(EventTypes.TASK_CANCELLED, context), task);
        if (task.isShared()) {
            event.audit("tasks", "Cancelled a task", task.getTitle());
        }
        events.publish(Topics.TASK, event.build());
    }

    /** Gives a shared task to someone (or to nobody). Private tasks stay with their owner. */
    @Transactional
    public TaskView assign(UUID id, UUID memberId) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        if (!task.isShared()) {
            throw ApiException.unprocessable("A private task can’t be given to someone else. Share it with the family first.");
        }
        if (memberId != null && !People.isMember(directory, memberId)) {
            throw ApiException.notFound("That family member");
        }
        String before = Names.of(directory.members(), task.getAssigneeId());
        task.setAssigneeId(memberId);
        task.setAcknowledgedConflict(null);
        tasks.save(task);

        Events event = describe(Events.of(EventTypes.TASK_ASSIGNED, context), task)
                .audit("tasks", "Handed over a task", task.getTitle(), before, Names.of(directory.members(), memberId));
        askToDo(event, context, task);
        events.publish(Topics.TASK, event.build());
        return TaskViews.view(task);
    }

    /* ───────── for decision-service ───────── */

    /**
     * Applies a change decided in decision-service (a handover it approved, or a what-if change). That
     * service checks who may do it and records the activity, so nothing is logged here.
     */
    @Transactional
    public TaskView applyPlan(UUID id, PlanChange change) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Task task = find(context, id);
        if (change.changeAssignee()) {
            if (!task.isShared() && !Objects.equals(change.assigneeId(), task.getAssigneeId())) {
                throw ApiException.unprocessable("A private task can’t be given to someone else.");
            }
            if (change.assigneeId() != null && !People.isMember(directory, change.assigneeId())) {
                throw ApiException.notFound("That family member");
            }
            task.setAssigneeId(change.assigneeId());
        }
        if (change.start() != null) {
            task.setStartAt(change.start());
        }
        task.setAcknowledgedConflict(null);
        tasks.save(task);
        events.publish(Topics.TASK, describe(Events.of(EventTypes.TASK_UPDATED, context), task).build());
        return TaskViews.view(task);
    }

    /** The owner keeps the plan despite a clash of this kind; decision-service records why. */
    @Transactional
    public void acknowledge(UUID id, String kind) {
        FamilyContext context = directory.context();
        Task task = find(context, id);
        task.setAcknowledgedConflict(kind);
        tasks.save(task);
    }

    /* ───────── helpers ───────── */

    private Task find(FamilyContext context, UUID id) {
        return tasks.findByIdAndFamilyId(id, context.familyId()).filter(task -> task.isVisibleTo(context.memberId())).orElseThrow(() -> ApiException.notFound("That task"));
    }

    /** A private task always belongs to the person who wrote it. */
    private void apply(Task task, TaskInput input, FamilyContext context) {
        UUID assignee = Task.PRIVATE.equals(input.visibility()) ? context.memberId() : input.assigneeId();
        if (assignee != null && !People.isMember(directory, assignee)) {
            throw ApiException.unprocessable("Choose someone from your family to do it.");
        }
        if (input.forId() != null && !People.exists(directory, input.forId())) {
            throw ApiException.unprocessable("Choose who the task is for from your family.");
        }
        task.setTitle(input.title().trim());
        task.setNotes(Formats.trim(input.notes()));
        task.setCategory(input.category());
        task.setPriority(input.priority());
        task.setStartAt(input.start());
        task.setDurationMin(input.durationMin());
        task.setAssigneeId(assignee);
        task.setForId(input.forId());
        task.setVisibility(input.visibility());
        task.setAppointmentId(input.appointmentId());
        task.setReminder(input.reminder());
        task.setTimezone(context.zone().getId());
    }

    /** "Rafid Mannan · Mon, Oct 21, 5:00 PM", as the activity log shows a task's plan. */
    private String summary(Task task, FamilyContext context) {
        return Names.of(directory.members(), task.getAssigneeId()) + " · " + Formats.dayTime(task.getStartAt(), context.zone());
    }

    /** Tells the person who now has the task. Not the caller, who already knows. */
    private void askToDo(Events event, FamilyContext context, Task task) {
        UUID assignee = task.getAssigneeId();
        if (assignee != null && !assignee.equals(context.memberId())) {
            event.notifyMember(assignee, "task", Names.first(context.memberName()) + " asked you to do “" + task.getTitle() + "” (" + Formats.dayTime(task.getStartAt(), context.zone()) + ").", "/tasks/" + task.getId());
        }
    }

    /** The ids other services react to. Present on private tasks too: they carry no titles. */
    static Events describe(Events event, Task task) {
        return event
                .data("taskId", task.getId())
                .data("assigneeId", task.getAssigneeId())
                .data("appointmentId", task.getAppointmentId())
                .data("visibility", task.getVisibility());
    }
}
