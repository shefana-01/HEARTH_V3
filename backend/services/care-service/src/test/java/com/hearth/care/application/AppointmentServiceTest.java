package com.hearth.care.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Appointment.Prep;
import com.hearth.care.domain.CareDocument;
import com.hearth.care.domain.PrepItem;
import com.hearth.care.dto.CareDtos.AppointmentInput;
import com.hearth.care.dto.CareDtos.AppointmentView;
import com.hearth.care.graph.CareGraphService;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.care.infrastructure.repository.CareDocumentRepository;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Topics;
import com.hearth.common.family.Availability;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AppointmentServiceTest {

    private FamilyDirectory directory;
    private AppointmentRepository appointments;
    private CareDocumentRepository documents;
    private EventPublisher events;
    private CareGraphService graph;
    private AppointmentService service;

    private final UUID familyId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID otherMemberId = UUID.randomUUID();
    private final UUID escortId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        appointments = mock(AppointmentRepository.class);
        documents = mock(CareDocumentRepository.class);
        events = mock(EventPublisher.class);
        graph = mock(CareGraphService.class);

        service = new AppointmentService(directory, appointments, documents, events, graph);

        FamilyContext context = new FamilyContext(
                UUID.randomUUID(), memberId, "Shovon Debnath", familyId, "lead", true, true, true, "UTC");
        when(directory.context()).thenReturn(context);

        MemberRef self = new MemberRef(memberId, "Shovon Debnath", "lead", "active", List.of(), Availability.weekdays());
        MemberRef other = new MemberRef(otherMemberId, "Afsara Mannan", "contributor", "active", List.of(), Availability.weekdays());
        MemberRef escort = new MemberRef(escortId, "Escort Member", "contributor", "active", List.of(), Availability.weekdays());

        when(directory.members()).thenReturn(List.of(self, other, escort));
        when(directory.dependants()).thenReturn(List.of());
    }

    private Appointment createTestAppointment(String title, UUID forId, String visibility) {
        Appointment app = new Appointment();
        app.setId(UUID.randomUUID());
        app.setFamilyId(familyId);
        app.setTitle(title);
        app.setSpecialty("General Checkup");
        app.setStartAt(Instant.now().plus(1, ChronoUnit.DAYS));
        app.setDurationMin(30);
        app.setProvider("HealthCare Clinic");
        app.setLocation("Main Street");
        app.setForId(forId);
        app.setEscortId(escortId);
        app.setVisibility(visibility);
        app.setCreatedById(memberId);
        app.setCreatedAt(Instant.now());
        app.setNote("Please arrive 10 minutes early.");
        app.setPrep(Prep.empty());
        return app;
    }

    @Test
    @DisplayName("list() returns family shared appointments and hides private visits for others")
    void listReturnsVisibleAppointments() {
        Appointment shared = createTestAppointment("Shared Dentist", otherMemberId, Appointment.FAMILY);
        Appointment privateSelf = createTestAppointment("Private Therapy", memberId, Appointment.PRIVATE);
        Appointment privateOther = createTestAppointment("Private Other Visit", otherMemberId, Appointment.PRIVATE);
        privateOther.setCreatedById(otherMemberId);
        privateOther.setEscortId(otherMemberId);

        when(appointments.findByFamilyIdOrderByStartAtAsc(familyId))
                .thenReturn(List.of(shared, privateSelf, privateOther));

        List<AppointmentView> result = service.list();

        assertThat(result).hasSize(2);
        assertThat(result.stream().map(AppointmentView::title))
                .containsExactlyInAnyOrder("Shared Dentist", "Private Therapy");
    }

    @Test
    @DisplayName("get() throws notFound when appointment is private and caller is not attendee or creator")
    void getThrowsNotFoundForHiddenPrivateAppointment() {
        Appointment privateOther = createTestAppointment("Secret Visit", otherMemberId, Appointment.PRIVATE);
        privateOther.setCreatedById(otherMemberId);
        privateOther.setEscortId(otherMemberId);

        when(appointments.findByIdAndFamilyId(privateOther.getId(), familyId))
                .thenReturn(Optional.of(privateOther));

        assertThatThrownBy(() -> service.get(privateOther.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That appointment");
    }

    @Test
    @DisplayName("create() persists new appointment, attaches prep checklist, and publishes event")
    void createPersistsAndPublishes() {
        Instant start = Instant.now().plus(2, ChronoUnit.DAYS);
        AppointmentInput input = new AppointmentInput(
                "Cardiologist Visit", "Cardiology", start, 45, "Heart Care", "City Hospital",
                memberId, escortId, Appointment.FAMILY, List.of("Bring ECG report", "Wear comfortable shoes"), "Annual checkup");

        AppointmentView view = service.create(input);

        assertThat(view.title()).isEqualTo("Cardiologist Visit");
        assertThat(view.prep()).hasSize(2);
        assertThat(view.prep().get(0).label()).isEqualTo("Bring ECG report");

        verify(appointments).save(any(Appointment.class));
        verify(events).publish(eq(Topics.CARE), any(DomainEvent.class));
        verify(graph).markChanged(familyId);
    }

    @Test
    @DisplayName("update() updates fields and clears reminder when start time is shifted")
    void updateModifiesAppointmentAndClearsReminder() {
        Appointment app = createTestAppointment("Eye Checkup", memberId, Appointment.FAMILY);
        app.setReminderSentAt(Instant.now());

        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));

        Instant newStart = app.getStartAt().plus(3, ChronoUnit.HOURS);
        AppointmentInput input = new AppointmentInput(
                "Eye Checkup - Rescheduled", "Ophthalmology", newStart, 30, "Optics Plus", "Downtown",
                memberId, escortId, Appointment.FAMILY, List.of(), "Updated note");

        AppointmentView updated = service.update(app.getId(), input);

        assertThat(updated.title()).isEqualTo("Eye Checkup - Rescheduled");
        assertThat(app.getReminderSentAt()).isNull();
        verify(appointments).save(app);
        verify(events).publish(eq(Topics.CARE), any(DomainEvent.class));
    }

    @Test
    @DisplayName("remove() deletes appointment, unlinks associated documents, and triggers care event")
    void removeDeletesAndUnlinksDocs() {
        Appointment app = createTestAppointment("Physical Therapy", memberId, Appointment.FAMILY);
        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));

        CareDocument doc = new CareDocument();
        doc.setId(UUID.randomUUID());
        doc.setFamilyId(familyId);
        doc.setAppointmentId(app.getId());

        when(documents.findByFamilyIdAndAppointmentId(familyId, app.getId())).thenReturn(List.of(doc));

        service.remove(app.getId());

        verify(appointments).delete(app);
        assertThat(doc.getAppointmentId()).isNull();
        verify(documents).saveAll(List.of(doc));
        verify(events).publish(eq(Topics.CARE), any(DomainEvent.class));
        verify(graph).markChanged(familyId);
    }

    @Test
    @DisplayName("addPrep() appends prep item to existing checklist")
    void addPrepAppendsItem() {
        Appointment app = createTestAppointment("Dental Cleaning", memberId, Appointment.FAMILY);
        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));
        when(appointments.save(any(Appointment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AppointmentView view = service.addPrep(app.getId(), "Brush thoroughly");

        assertThat(view.prep()).hasSize(1);
        assertThat(view.prep().get(0).label()).isEqualTo("Brush thoroughly");
        assertThat(view.prep().get(0).done()).isFalse();
    }

    @Test
    @DisplayName("addPrep() throws unprocessable when checklist reaches 30 items")
    void addPrepRejectsOverflow() {
        Appointment app = createTestAppointment("Surgery Consult", memberId, Appointment.FAMILY);
        List<PrepItem> items = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            items.add(new PrepItem(UUID.randomUUID().toString(), "Item " + i, false, null));
        }
        app.setPrep(new Prep(items));

        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));

        assertThatThrownBy(() -> service.addPrep(app.getId(), "Item 31"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("checklist is full");
    }

    @Test
    @DisplayName("togglePrep() toggles done status and records member id")
    void togglePrepTogglesStatus() {
        Appointment app = createTestAppointment("Blood Work", memberId, Appointment.FAMILY);
        String prepId = UUID.randomUUID().toString();
        app.setPrep(new Prep(List.of(new PrepItem(prepId, "Fasting 8 hours", false, null))));

        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));
        when(appointments.save(any(Appointment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AppointmentView view = service.togglePrep(app.getId(), prepId);

        assertThat(view.prep()).hasSize(1);
        assertThat(view.prep().get(0).done()).isTrue();
        assertThat(view.prep().get(0).doneById()).isEqualTo(memberId.toString());
    }

    @Test
    @DisplayName("removePrep() filters out the specified item")
    void removePrepDeletesItem() {
        Appointment app = createTestAppointment("X-Ray", memberId, Appointment.FAMILY);
        String prepId1 = UUID.randomUUID().toString();
        String prepId2 = UUID.randomUUID().toString();
        app.setPrep(new Prep(new ArrayList<>(List.of(
                new PrepItem(prepId1, "Remove metal jewelry", false, null),
                new PrepItem(prepId2, "Bring ID", false, null)))));

        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));
        when(appointments.save(any(Appointment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AppointmentView view = service.removePrep(app.getId(), prepId1);

        assertThat(view.prep()).hasSize(1);
        assertThat(view.prep().get(0).id()).isEqualTo(prepId2);
    }

    @Test
    @DisplayName("memberLeft() deletes departed member's visits and clears escort from other visits")
    void memberLeftCleansUpAppointments() {
        UUID departedMemberId = UUID.randomUUID();

        Appointment visitForMember = createTestAppointment("Checkup for departed", departedMemberId, Appointment.FAMILY);
        Appointment visitEscortedByMember = createTestAppointment("Other visit escorted", memberId, Appointment.FAMILY);
        visitEscortedByMember.setEscortId(departedMemberId);

        when(appointments.findByFamilyIdAndForId(familyId, departedMemberId)).thenReturn(List.of(visitForMember));
        when(appointments.findByFamilyIdAndEscortId(familyId, departedMemberId)).thenReturn(List.of(visitEscortedByMember));
        when(documents.findByFamilyIdAndAppointmentId(familyId, visitForMember.getId())).thenReturn(List.of());

        service.memberLeft(familyId, departedMemberId);

        verify(appointments).delete(visitForMember);
        assertThat(visitEscortedByMember.getEscortId()).isNull();
        verify(appointments).saveAll(List.of(visitEscortedByMember));
    }

    @Test
    @DisplayName("followTask() reassigns escortId to new task owner")
    void followTaskReassignsEscort() {
        Appointment app = createTestAppointment("Vaccination", otherMemberId, Appointment.FAMILY);
        app.setEscortId(escortId);

        when(appointments.findByIdAndFamilyId(app.getId(), familyId)).thenReturn(Optional.of(app));

        service.followTask(familyId, app.getId(), memberId);

        assertThat(app.getEscortId()).isEqualTo(memberId);
        verify(appointments).save(app);
    }
}
