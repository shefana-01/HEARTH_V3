package com.hearth.task.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Topics;
import com.hearth.common.family.Availability;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import com.hearth.task.domain.Task;
import com.hearth.task.dto.TaskDtos.PlanChange;
import com.hearth.task.dto.TaskDtos.TaskInput;
import com.hearth.task.dto.TaskDtos.TaskView;
import com.hearth.task.repository.TaskRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class TaskServiceTest {

    private FamilyDirectory directory;
    private TaskRepository tasks;
    private EventPublisher events;
    private TaskService service;

    private UUID familyId;
    private UUID leadMemberId;
    private UUID childMemberId;
    private FamilyContext leadContext;
    private FamilyContext observerContext;

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        tasks = mock(TaskRepository.class);
        events = mock(EventPublisher.class);
        service = new TaskService(directory, tasks, events);

        familyId = UUID.randomUUID();
        leadMemberId = UUID.randomUUID();
        childMemberId = UUID.randomUUID();

        leadContext = new FamilyContext(
                UUID.randomUUID(),
                leadMemberId,
                "Afsara Mannan",
                familyId,
                "lead",
                true,
                true,
                true,
                "UTC"
        );

        observerContext = new FamilyContext(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Observer User",
                familyId,
                "observer",
                true,
                false,
                false,
                "UTC"
        );

        MemberRef leadRef = new MemberRef(leadMemberId, "Afsara Mannan", "lead", "active", List.of("cooking"), Availability.weekdays());
        MemberRef childRef = new MemberRef(childMemberId, "Child Mannan", "contributor", "active", List.of("chores"), Availability.weekdays());
        when(directory.members()).thenReturn(List.of(leadRef, childRef));
    }

    @Test
    @DisplayName("list() returns visible tasks and filters out cancelled tasks when includeCancelled is false")
    void list_filtersVisibilityAndCancelled() {
        when(directory.context()).thenReturn(leadContext);

        Task sharedTask = new Task(familyId, leadMemberId);
        sharedTask.setTitle("Buy Groceries");
        sharedTask.setCategory("errands");
        sharedTask.setPriority("routine");
        sharedTask.setStartAt(Instant.now());
        sharedTask.setDurationMin(30);
        sharedTask.setVisibility(Task.FAMILY);

        Task cancelledTask = new Task(familyId, leadMemberId);
        cancelledTask.setTitle("Old Meeting");
        cancelledTask.setCategory("other");
        cancelledTask.setPriority("routine");
        cancelledTask.setStartAt(Instant.now());
        cancelledTask.setDurationMin(15);
        cancelledTask.setVisibility(Task.FAMILY);
        cancelledTask.cancel();

        Task otherPrivateTask = new Task(familyId, childMemberId);
        otherPrivateTask.setTitle("Private Journal");
        otherPrivateTask.setCategory("other");
        otherPrivateTask.setPriority("routine");
        otherPrivateTask.setStartAt(Instant.now());
        otherPrivateTask.setDurationMin(15);
        otherPrivateTask.setVisibility(Task.PRIVATE);

        when(tasks.findByFamilyIdOrderByStartAtAscIdAsc(familyId))
                .thenReturn(List.of(sharedTask, cancelledTask, otherPrivateTask));

        List<TaskView> result = service.list(null, false);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Buy Groceries");
    }

    @Test
    @DisplayName("list() filters by assignee when assigneeId is provided")
    void list_filtersByAssignee() {
        when(directory.context()).thenReturn(leadContext);

        Task assignedToLead = new Task(familyId, leadMemberId);
        assignedToLead.setTitle("Lead Task");
        assignedToLead.setCategory("household");
        assignedToLead.setPriority("routine");
        assignedToLead.setStartAt(Instant.now());
        assignedToLead.setDurationMin(20);
        assignedToLead.setVisibility(Task.FAMILY);
        assignedToLead.setAssigneeId(leadMemberId);

        Task assignedToChild = new Task(familyId, leadMemberId);
        assignedToChild.setTitle("Child Task");
        assignedToChild.setCategory("household");
        assignedToChild.setPriority("routine");
        assignedToChild.setStartAt(Instant.now());
        assignedToChild.setDurationMin(20);
        assignedToChild.setVisibility(Task.FAMILY);
        assignedToChild.setAssigneeId(childMemberId);

        when(tasks.findByFamilyIdOrderByStartAtAscIdAsc(familyId))
                .thenReturn(List.of(assignedToLead, assignedToChild));

        List<TaskView> result = service.list(leadMemberId, false);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Lead Task");
    }

    @Test
    @DisplayName("get() returns task view when task exists and is visible")
    void get_returnsTaskView() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Prepare Dinner");
        task.setCategory("meals");
        task.setPriority("important");
        task.setStartAt(Instant.now());
        task.setDurationMin(45);
        task.setVisibility(Task.FAMILY);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        TaskView view = service.get(taskId);

        assertThat(view).isNotNull();
        assertThat(view.title()).isEqualTo("Prepare Dinner");
        assertThat(view.category()).isEqualTo("meals");
    }

    @Test
    @DisplayName("get() throws 404 when task belongs to another or is private to someone else")
    void get_throwsNotFound_whenNotVisible() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task privateTaskOfChild = new Task(familyId, childMemberId);
        privateTaskOfChild.setTitle("Secret Task");
        privateTaskOfChild.setCategory("other");
        privateTaskOfChild.setPriority("routine");
        privateTaskOfChild.setStartAt(Instant.now());
        privateTaskOfChild.setDurationMin(15);
        privateTaskOfChild.setVisibility(Task.PRIVATE);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(privateTaskOfChild));

        assertThatThrownBy(() -> service.get(taskId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That task");
    }

    @Test
    @DisplayName("create() creates shared task, persists to repository and publishes event")
    void create_sharedTask_savesAndPublishesEvent() {
        when(directory.context()).thenReturn(leadContext);
        Instant start = Instant.now().plusSeconds(3600);

        TaskInput input = new TaskInput(
                "Clean the kitchen",
                "Use sanitiser",
                "household",
                "routine",
                start,
                30,
                leadMemberId,
                null,
                Task.FAMILY,
                null,
                true
        );

        TaskView created = service.create(input);

        assertThat(created).isNotNull();
        assertThat(created.title()).isEqualTo("Clean the kitchen");
        assertThat(created.durationMin()).isEqualTo(30);

        verify(tasks).save(any(Task.class));
        ArgumentCaptor<DomainEvent> eventCaptor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), eventCaptor.capture());

        DomainEvent event = eventCaptor.getValue();
        assertThat(event.type()).isEqualTo(EventTypes.TASK_CREATED);
        assertThat(event.familyId()).isEqualTo(familyId);
    }

    @Test
    @DisplayName("create() fails with 403 when caller is observer")
    void create_fails_whenObserver() {
        when(directory.context()).thenReturn(observerContext);

        TaskInput input = new TaskInput(
                "Take out trash",
                null,
                "household",
                "routine",
                Instant.now(),
                15,
                null,
                null,
                Task.FAMILY,
                null,
                false
        );

        assertThatThrownBy(() -> service.create(input))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Observers can view the plan but cannot change it");

        verify(tasks, never()).save(any());
        verify(events, never()).publish(any(), any());
    }

    @Test
    @DisplayName("complete() sets completed state, completedBy and publishes event")
    void complete_setsCompletedState() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Wash car");
        task.setCategory("household");
        task.setPriority("routine");
        task.setStartAt(Instant.now());
        task.setDurationMin(60);
        task.setVisibility(Task.FAMILY);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        TaskView completed = service.complete(taskId);

        assertThat(completed.status()).isEqualTo(Task.COMPLETED);
        assertThat(task.getCompletedById()).isEqualTo(leadMemberId);
        assertThat(task.getCompletedAt()).isNotNull();

        verify(tasks).save(task);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("reopen() restores scheduled status on completed task")
    void reopen_restoresScheduledStatus() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Fix bicycle");
        task.setCategory("errands");
        task.setPriority("important");
        task.setStartAt(Instant.now());
        task.setDurationMin(40);
        task.setVisibility(Task.FAMILY);
        task.complete(leadMemberId);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        TaskView reopened = service.reopen(taskId);

        assertThat(reopened.status()).isEqualTo(Task.SCHEDULED);
        assertThat(task.getCompletedAt()).isNull();
        assertThat(task.getCompletedById()).isNull();

        verify(tasks).save(task);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("cancel() marks task as cancelled and records audit event")
    void cancel_marksTaskCancelled() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Cancel meeting");
        task.setCategory("other");
        task.setPriority("routine");
        task.setStartAt(Instant.now());
        task.setDurationMin(15);
        task.setVisibility(Task.FAMILY);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        service.cancel(taskId);

        assertThat(task.getStatus()).isEqualTo(Task.CANCELLED);
        verify(tasks).save(task);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("assign() changes assignee on shared task and resets acknowledged conflict")
    void assign_updatesAssignee() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Organise pantry");
        task.setCategory("household");
        task.setPriority("routine");
        task.setStartAt(Instant.now());
        task.setDurationMin(30);
        task.setVisibility(Task.FAMILY);
        task.setAssigneeId(leadMemberId);
        task.setAcknowledgedConflict("overlap");

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        TaskView result = service.assign(taskId, childMemberId);

        assertThat(result.assigneeId()).isEqualTo(childMemberId);
        assertThat(task.getAcknowledgedConflict()).isNull();

        verify(tasks).save(task);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("assign() throws 422 unprocessable when assigning a private task")
    void assign_throwsUnprocessable_whenTaskIsPrivate() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task privateTask = new Task(familyId, leadMemberId);
        privateTask.setTitle("Personal doctor note");
        privateTask.setCategory("health");
        privateTask.setPriority("urgent");
        privateTask.setStartAt(Instant.now());
        privateTask.setDurationMin(20);
        privateTask.setVisibility(Task.PRIVATE);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(privateTask));

        assertThatThrownBy(() -> service.assign(taskId, childMemberId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("A private task can’t be given to someone else");

        verify(tasks, never()).save(any());
    }

    @Test
    @DisplayName("applyPlan() updates task plan parameters and publishes update event")
    void applyPlan_updatesAssigneeAndStart() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Study group");
        task.setCategory("study");
        task.setPriority("routine");
        task.setStartAt(Instant.now());
        task.setDurationMin(60);
        task.setVisibility(Task.FAMILY);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        Instant newStart = Instant.now().plusSeconds(7200);
        PlanChange change = new PlanChange(true, childMemberId, newStart);

        TaskView updated = service.applyPlan(taskId, change);

        assertThat(updated.assigneeId()).isEqualTo(childMemberId);
        assertThat(task.getStartAt()).isEqualTo(newStart);
        assertThat(task.getAcknowledgedConflict()).isNull();

        verify(tasks).save(task);
        verify(events).publish(org.mockito.ArgumentMatchers.eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("acknowledge() records conflict kind on task")
    void acknowledge_setsConflictKind() {
        when(directory.context()).thenReturn(leadContext);
        UUID taskId = UUID.randomUUID();

        Task task = new Task(familyId, leadMemberId);
        task.setTitle("Conflict task");
        task.setCategory("other");
        task.setPriority("routine");
        task.setStartAt(Instant.now());
        task.setDurationMin(15);
        task.setVisibility(Task.FAMILY);

        when(tasks.findByIdAndFamilyId(taskId, familyId)).thenReturn(Optional.of(task));

        service.acknowledge(taskId, "overlap");

        assertThat(task.getAcknowledgedConflict()).isEqualTo("overlap");
        verify(tasks).save(task);
    }
}
