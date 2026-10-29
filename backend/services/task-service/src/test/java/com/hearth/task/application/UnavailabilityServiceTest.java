package com.hearth.task.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.task.domain.Task;
import com.hearth.task.domain.Unavailability;
import com.hearth.task.dto.TaskDtos.UnavailabilityInput;
import com.hearth.task.dto.TaskDtos.UnavailabilityResult;
import com.hearth.task.dto.TaskDtos.UnavailabilityView;
import com.hearth.task.repository.TaskRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class UnavailabilityServiceTest {

    private FamilyDirectory directory;
    private com.hearth.task.repository.UnavailabilityRepository unavailability;
    private TaskRepository tasks;
    private EventPublisher events;
    private UnavailabilityService service;

    private UUID familyId;
    private UUID leadMemberId;
    private UUID childMemberId;
    private FamilyContext leadContext;
    private FamilyContext contributorContext;

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        unavailability = mock(com.hearth.task.repository.UnavailabilityRepository.class);
        tasks = mock(TaskRepository.class);
        events = mock(EventPublisher.class);
        service = new UnavailabilityService(directory, unavailability, tasks, events);

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

        contributorContext = new FamilyContext(
                UUID.randomUUID(),
                childMemberId,
                "Child Mannan",
                familyId,
                "contributor",
                true,
                false,
                false,
                "UTC"
        );
    }

    @Test
    @DisplayName("list() returns all family unavailability when memberId is null")
    void list_returnsAllFamilyUnavailability() {
        when(directory.context()).thenReturn(leadContext);

        Unavailability entry = new Unavailability(
                familyId,
                leadMemberId,
                Instant.now(),
                Instant.now().plus(2, ChronoUnit.HOURS),
                "Doctor appointment",
                "Specialist clinic"
        );

        when(unavailability.findByFamilyIdOrderByStartAtAsc(familyId))
                .thenReturn(List.of(entry));

        List<UnavailabilityView> result = service.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).reason()).isEqualTo("Doctor appointment");
    }

    @Test
    @DisplayName("list() filters by memberId when provided")
    void list_filtersByMemberId() {
        when(directory.context()).thenReturn(leadContext);

        Unavailability entry = new Unavailability(
                familyId,
                childMemberId,
                Instant.now(),
                Instant.now().plus(3, ChronoUnit.HOURS),
                "School trip",
                "Museum visit"
        );

        when(unavailability.findByFamilyIdAndMemberIdOrderByStartAtAsc(familyId, childMemberId))
                .thenReturn(List.of(entry));

        List<UnavailabilityView> result = service.list(childMemberId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).memberId()).isEqualTo(childMemberId);
    }

    @Test
    @DisplayName("report() saves time away and calculates affected shared tasks")
    void report_savesAwayWindow_andPublishesEvent() {
        when(directory.context()).thenReturn(leadContext);
        Instant start = Instant.now().plus(1, ChronoUnit.DAYS);
        Instant end = start.plus(4, ChronoUnit.HOURS);

        Task sharedTask = new Task(familyId, leadMemberId);
        sharedTask.setTitle("Pick up groceries");
        sharedTask.setCategory("errands");
        sharedTask.setPriority("routine");
        sharedTask.setStartAt(start.plus(1, ChronoUnit.HOURS));
        sharedTask.setDurationMin(60);
        sharedTask.setVisibility(Task.FAMILY);

        Task privateTask = new Task(familyId, leadMemberId);
        privateTask.setTitle("Private errand");
        privateTask.setCategory("other");
        privateTask.setPriority("routine");
        privateTask.setStartAt(start.plus(2, ChronoUnit.HOURS));
        privateTask.setDurationMin(30);
        privateTask.setVisibility(Task.PRIVATE);

        when(tasks.findScheduledStartingBefore(familyId, leadMemberId, end))
                .thenReturn(List.of(sharedTask, privateTask));

        UnavailabilityInput input = new UnavailabilityInput(start, end, "Dentist", "Routine checkup");

        UnavailabilityResult result = service.report(input);

        assertThat(result).isNotNull();
        assertThat(result.unavailability().reason()).isEqualTo("Dentist");
        assertThat(result.affectedTaskIds()).containsExactly(sharedTask.getId());
        assertThat(result.personalTaskIds()).containsExactly(privateTask.getId());

        verify(unavailability).save(any(Unavailability.class));

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(events).publish(eq(Topics.TASK), captor.capture());
        DomainEvent published = captor.getValue();
        assertThat(published.type()).isEqualTo(EventTypes.UNAVAILABILITY_REPORTED);
        assertThat(published.familyId()).isEqualTo(familyId);
    }

    @Test
    @DisplayName("report() throws 422 when end time is before start time")
    void report_fails_whenEndBeforeStart() {
        when(directory.context()).thenReturn(leadContext);
        Instant start = Instant.now().plus(1, ChronoUnit.DAYS);
        Instant endBefore = start.minus(1, ChronoUnit.HOURS);

        UnavailabilityInput input = new UnavailabilityInput(start, endBefore, "Holiday", null);

        assertThatThrownBy(() -> service.report(input))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("The end time must be after the start time");

        verify(unavailability, never()).save(any());
        verify(events, never()).publish(any(), any());
    }

    @Test
    @DisplayName("report() throws 422 when duration exceeds 366 days")
    void report_fails_whenDurationExceedsOneYear() {
        when(directory.context()).thenReturn(leadContext);
        Instant start = Instant.now();
        Instant endWayAhead = start.plus(400, ChronoUnit.DAYS);

        UnavailabilityInput input = new UnavailabilityInput(start, endWayAhead, "Sabbatical", null);

        assertThatThrownBy(() -> service.report(input))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Time away can be up to a year at once");

        verify(unavailability, never()).save(any());
    }

    @Test
    @DisplayName("remove() deletes time away and publishes removal event when caller is owner")
    void remove_deletesAway_whenOwner() {
        when(directory.context()).thenReturn(contributorContext);
        UUID awayId = UUID.randomUUID();

        Unavailability away = new Unavailability(
                familyId,
                childMemberId,
                Instant.now(),
                Instant.now().plus(2, ChronoUnit.HOURS),
                "Family visit",
                ""
        );

        when(unavailability.findByIdAndFamilyId(awayId, familyId)).thenReturn(Optional.of(away));

        service.remove(awayId);

        verify(unavailability).delete(away);
        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(events).publish(eq(Topics.TASK), captor.capture());
        assertThat(captor.getValue().type()).isEqualTo(EventTypes.UNAVAILABILITY_REMOVED);
    }

    @Test
    @DisplayName("remove() allows family lead to remove someone else's time away")
    void remove_allowsLeadToRemoveOtherMembersAway() {
        when(directory.context()).thenReturn(leadContext);
        UUID awayId = UUID.randomUUID();

        Unavailability awayOfChild = new Unavailability(
                familyId,
                childMemberId,
                Instant.now(),
                Instant.now().plus(2, ChronoUnit.HOURS),
                "Trip",
                ""
        );

        when(unavailability.findByIdAndFamilyId(awayId, familyId)).thenReturn(Optional.of(awayOfChild));

        service.remove(awayId);

        verify(unavailability).delete(awayOfChild);
        verify(events).publish(eq(Topics.TASK), any(DomainEvent.class));
    }

    @Test
    @DisplayName("remove() throws 403 when non-lead tries to remove someone else's time away")
    void remove_fails_whenNonLeadTriesToRemoveOthersAway() {
        when(directory.context()).thenReturn(contributorContext);
        UUID awayId = UUID.randomUUID();

        Unavailability awayOfLead = new Unavailability(
                familyId,
                leadMemberId,
                Instant.now(),
                Instant.now().plus(2, ChronoUnit.HOURS),
                "Lead meeting",
                ""
        );

        when(unavailability.findByIdAndFamilyId(awayId, familyId)).thenReturn(Optional.of(awayOfLead));

        assertThatThrownBy(() -> service.remove(awayId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("You can only remove your own time away");

        verify(unavailability, never()).delete(any());
        verify(events, never()).publish(any(), any());
    }
}
