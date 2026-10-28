package com.hearth.task.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.Availability;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import com.hearth.task.domain.PersonalEvent;
import com.hearth.task.dto.TaskDtos.EventInput;
import com.hearth.task.dto.TaskDtos.EventView;
import com.hearth.task.repository.PersonalEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PersonalEventServiceTest {

    private FamilyDirectory directory;
    private PersonalEventRepository events;
    private PersonalEventService service;

    private UUID familyId;
    private UUID memberId;
    private UUID otherMemberId;
    private FamilyContext context;

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        events = mock(PersonalEventRepository.class);
        service = new PersonalEventService(directory, events);

        familyId = UUID.randomUUID();
        memberId = UUID.randomUUID();
        otherMemberId = UUID.randomUUID();

        context = new FamilyContext(
                UUID.randomUUID(),
                memberId,
                "Afsara Mannan",
                familyId,
                "lead",
                true,
                true,
                true,
                "UTC"
        );

        MemberRef leadRef = new MemberRef(memberId, "Afsara Mannan", "lead", "active", List.of(), Availability.weekdays());
        MemberRef otherRef = new MemberRef(otherMemberId, "Other Member", "contributor", "active", List.of(), Availability.weekdays());
        when(directory.members()).thenReturn(List.of(leadRef, otherRef));
    }

    @Test
    @DisplayName("list() defaults to caller's events when memberId is null")
    void list_defaultsToCallerEvents() {
        when(directory.context()).thenReturn(context);

        PersonalEvent event = new PersonalEvent(familyId, memberId);
        event.setTitle("Lecture");
        event.setKind("class");
        event.setStartAt(Instant.now());
        event.setDurationMin(60);
        event.setRepeat("none");
        event.setLocation("Campus Hall A");
        event.setVisibility("details");

        when(events.findByFamilyIdAndMemberIdOrderByStartAtAsc(familyId, memberId))
                .thenReturn(List.of(event));

        List<EventView> result = service.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Lecture");
    }

    @Test
    @DisplayName("list() throws 404 when requested memberId is not part of family")
    void list_throwsNotFound_whenMemberNotInFamily() {
        when(directory.context()).thenReturn(context);
        UUID nonFamilyMemberId = UUID.randomUUID();

        assertThatThrownBy(() -> service.list(nonFamilyMemberId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That family member");
    }

    @Test
    @DisplayName("get() returns full event details for owner")
    void get_returnsFullDetailsForOwner() {
        when(directory.context()).thenReturn(context);
        UUID eventId = UUID.randomUUID();

        PersonalEvent event = new PersonalEvent(familyId, memberId);
        event.setTitle("Work Shift");
        event.setKind("work");
        event.setStartAt(Instant.now());
        event.setDurationMin(240);
        event.setRepeat("none");
        event.setLocation("Office");
        event.setVisibility("busy");

        when(events.findByIdAndFamilyId(eventId, familyId)).thenReturn(Optional.of(event));

        EventView view = service.get(eventId);

        assertThat(view.title()).isEqualTo("Work Shift");
        assertThat(view.kind()).isEqualTo("work");
    }

    @Test
    @DisplayName("create() creates and persists personal event")
    void create_savesPersonalEvent() {
        when(directory.context()).thenReturn(context);
        Instant start = Instant.now().plusSeconds(3600);

        EventInput input = new EventInput(
                "Study session",
                "study",
                start,
                90,
                "none",
                null,
                null,
                "Library",
                "details"
        );

        EventView created = service.create(input);

        assertThat(created).isNotNull();
        assertThat(created.title()).isEqualTo("Study session");
        assertThat(created.durationMin()).isEqualTo(90);

        verify(events).save(any(PersonalEvent.class));
    }

    @Test
    @DisplayName("create() throws 422 when title is empty")
    void create_fails_whenTitleIsEmpty() {
        when(directory.context()).thenReturn(context);

        EventInput input = new EventInput(
                "   ",
                "personal",
                Instant.now(),
                60,
                "none",
                null,
                null,
                null,
                "details"
        );

        assertThatThrownBy(() -> service.create(input))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Give the event a name");

        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("create() throws 422 when duration is invalid")
    void create_fails_whenDurationOutOfBounds() {
        when(directory.context()).thenReturn(context);

        EventInput tooShort = new EventInput(
                "Quick blink",
                "personal",
                Instant.now(),
                2,
                "none",
                null,
                null,
                null,
                "details"
        );

        assertThatThrownBy(() -> service.create(tooShort))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("An event lasts between 5 minutes and 24 hours");

        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("create() validates weekly repetition day flags")
    void create_validatesWeeklyRepeatDays() {
        when(directory.context()).thenReturn(context);

        EventInput weeklyNoDays = new EventInput(
                "Weekly Seminar",
                "class",
                Instant.now(),
                60,
                "weekly",
                List.of(false, false, false, false, false, false, false),
                null,
                "Room 201",
                "details"
        );

        assertThatThrownBy(() -> service.create(weeklyNoDays))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Choose at least one day of the week");

        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("create() validates until is after start for weekly events")
    void create_validatesUntilAfterStart() {
        when(directory.context()).thenReturn(context);
        Instant start = Instant.now().plusSeconds(3600);
        Instant untilBeforeStart = start.minusSeconds(100);

        EventInput invalidWeekly = new EventInput(
                "Weekly Sync",
                "work",
                start,
                30,
                "weekly",
                List.of(true, false, true, false, false, false, false),
                untilBeforeStart,
                "Online",
                "details"
        );

        assertThatThrownBy(() -> service.create(invalidWeekly))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("The last day must be after the first one");

        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("update() modifies existing personal event when caller is owner")
    void update_modifiesEvent_whenOwner() {
        when(directory.context()).thenReturn(context);
        UUID eventId = UUID.randomUUID();

        PersonalEvent existing = new PersonalEvent(familyId, memberId);
        existing.setTitle("Old Title");
        existing.setKind("other");
        existing.setStartAt(Instant.now());
        existing.setDurationMin(30);
        existing.setRepeat("none");
        existing.setVisibility("details");

        when(events.findByIdAndFamilyId(eventId, familyId)).thenReturn(Optional.of(existing));

        EventInput updateInput = new EventInput(
                "Updated Title",
                "work",
                Instant.now().plusSeconds(1800),
                45,
                "none",
                null,
                null,
                "New Room",
                "busy"
        );

        EventView result = service.update(eventId, updateInput);

        assertThat(result.title()).isEqualTo("Updated Title");
        assertThat(existing.getTitle()).isEqualTo("Updated Title");
        assertThat(existing.getKind()).isEqualTo("work");
        assertThat(existing.getDurationMin()).isEqualTo(45);
        verify(events).save(existing);
    }

    @Test
    @DisplayName("update() throws 404 when caller is not the owner of the event")
    void update_throwsNotFound_whenNotOwner() {
        when(directory.context()).thenReturn(context);
        UUID eventId = UUID.randomUUID();

        PersonalEvent othersEvent = new PersonalEvent(familyId, otherMemberId);
        othersEvent.setTitle("Someone else's event");
        othersEvent.setKind("work");
        othersEvent.setStartAt(Instant.now());
        othersEvent.setDurationMin(60);
        othersEvent.setRepeat("none");
        othersEvent.setVisibility("details");

        when(events.findByIdAndFamilyId(eventId, familyId)).thenReturn(Optional.of(othersEvent));

        EventInput updateInput = new EventInput(
                "Trying to hijack",
                "work",
                Instant.now(),
                60,
                "none",
                null,
                null,
                null,
                "details"
        );

        assertThatThrownBy(() -> service.update(eventId, updateInput))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That event");

        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("remove() deletes event when caller is owner")
    void remove_deletesEvent_whenOwner() {
        when(directory.context()).thenReturn(context);
        UUID eventId = UUID.randomUUID();

        PersonalEvent ownEvent = new PersonalEvent(familyId, memberId);
        ownEvent.setTitle("Event to delete");
        ownEvent.setKind("personal");
        ownEvent.setStartAt(Instant.now());
        ownEvent.setDurationMin(30);
        ownEvent.setRepeat("none");
        ownEvent.setVisibility("details");

        when(events.findByIdAndFamilyId(eventId, familyId)).thenReturn(Optional.of(ownEvent));

        service.remove(eventId);

        verify(events).delete(ownEvent);
    }
}
