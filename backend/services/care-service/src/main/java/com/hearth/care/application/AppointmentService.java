package com.hearth.care.application;

import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Appointment.Prep;
import com.hearth.care.domain.PrepItem;
import com.hearth.care.domain.CareDocument;
import com.hearth.care.dto.CareDtos.AppointmentInput;
import com.hearth.care.dto.CareDtos.AppointmentView;
import com.hearth.care.dto.CareDtos.PrepItemView;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.care.infrastructure.repository.CareDocumentRepository;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.Names;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Appointments for one person (a member or someone the family looks after).
 *
 * A private appointment is only visible to the people involved: the person it is for, whoever goes
 * along and whoever wrote it down. Everyone else gets a 404 for it, and it never reaches the activity
 * log. (Planning is the one exception: see {@link #listForPlanning()}.)
 */
@Service
public class AppointmentService {

    private final FamilyDirectory directory;
    private final AppointmentRepository appointments;
    private final CareDocumentRepository documents;
    private final EventPublisher events;

    public AppointmentService(FamilyDirectory directory, AppointmentRepository appointments, CareDocumentRepository documents, EventPublisher events) {
        this.directory = directory;
        this.appointments = appointments;
        this.documents = documents;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<AppointmentView> list() {
        FamilyContext context = directory.context();
        return appointments.findByFamilyIdOrderByStartAtAsc(context.familyId()).stream().filter(appointment -> canSee(appointment, context)).map(AppointmentService::view).toList();
    }

    @Transactional(readOnly = true)
    public AppointmentView get(UUID id) {
        return view(find(directory.context(), id));
    }

    /**
     * Every appointment of the family, for decision-service. Time and people are always real, because a
     * clash with someone's private visit has to be detected; what the visit is about is blanked for
     * anyone who may not see it.
     */
    @Transactional(readOnly = true)
    public List<AppointmentView> listForPlanning() {
        FamilyContext context = directory.context();
        return appointments.findByFamilyIdOrderByStartAtAsc(context.familyId()).stream()
                .map(appointment -> canSee(appointment, context) ? view(appointment) : masked(appointment))
                .toList();
    }

    @Transactional
    public AppointmentView create(AppointmentInput input) {
        FamilyContext context = directory.context();
        context.requireContributor();
        requirePeople(input);

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setFamilyId(context.familyId());
        appointment.setCreatedById(context.memberId());
        appointment.setCreatedAt(Instant.now());
        apply(appointment, input, context);
        List<PrepItem> prep = new ArrayList<>();
        for (String label : input.prep() == null ? List.<String>of() : input.prep()) {
            if (label != null && !label.isBlank()) {
                prep.add(new PrepItem(UUID.randomUUID().toString(), label.trim(), false, null));
            }
        }
        appointment.setPrep(new Prep(prep));
        appointments.save(appointment);

        Events event = describe(Events.of("appointment.created", context), appointment);
        if (appointment.isShared()) {
            event.audit("care", "Added an appointment", appointment.getTitle(), null, People.name(directory, appointment.getForId()) + " · " + Formats.dayTime(appointment.getStartAt(), context.zone()));
        }
        askToGoAlong(event, context, appointment);
        events.publish(Topics.CARE, event.build());
        return view(appointment);
    }

    @Transactional
    public AppointmentView update(UUID id, AppointmentInput input) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Appointment appointment = find(context, id);
        requirePeople(input);
        UUID previousEscort = appointment.getEscortId();
        Instant previousStart = appointment.getStartAt();
        apply(appointment, input, context);
        if (!appointment.getStartAt().equals(previousStart)) {
            // Moved: the reminder for the new time has not gone out yet.
            appointment.setReminderSentAt(null);
        }
        appointments.save(appointment);

        // task-service gives the shared tasks linked to this visit to the same escort when it sees this event.
        Events event = describe(Events.of("appointment.updated", context), appointment);
        if (appointment.isShared()) {
            event.audit("care", "Edited an appointment", appointment.getTitle());
        }
        if (!Objects.equals(previousEscort, appointment.getEscortId())) {
            askToGoAlong(event, context, appointment);
        }
        events.publish(Topics.CARE, event.build());
        return view(appointment);
    }

    @Transactional
    public void remove(UUID id) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Appointment appointment = find(context, id);
        delete(appointment);

        Events event = describe(Events.of("appointment.removed", context), appointment);
        if (appointment.isShared()) {
            event.audit("care", "Removed an appointment", appointment.getTitle());
        }
        events.publish(Topics.CARE, event.build());
    }

    @Transactional
    public AppointmentView addPrep(UUID id, String label) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Appointment appointment = find(context, id);
        List<PrepItem> items = new ArrayList<>(appointment.getPrep().itemsOrEmpty());
        if (items.size() >= 30) {
            throw ApiException.unprocessable("That checklist is full.");
        }
        items.add(new PrepItem(UUID.randomUUID().toString(), label.trim(), false, null));
        appointment.setPrep(new Prep(items));
        return view(appointments.save(appointment));
    }

    @Transactional
    public AppointmentView togglePrep(UUID id, String prepId) {
        FamilyContext context = directory.context();
        context.requireContributor();
        // A visit the caller may not see is reported like a missing item, so its checklist stays unknown.
        Appointment appointment = findVisible(context, id).orElseThrow(() -> ApiException.notFound("That item"));
        List<PrepItem> items = new ArrayList<>();
        boolean found = false;
        for (PrepItem item : appointment.getPrep().itemsOrEmpty()) {
            if (item.id().equals(prepId)) {
                found = true;
                boolean done = !item.done();
                items.add(new PrepItem(item.id(), item.label(), done, done ? context.memberId().toString() : null));
            } else {
                items.add(item);
            }
        }
        if (!found) {
            throw ApiException.notFound("That item");
        }
        // A new Prep object, so Hibernate sees the JSON column changed.
        appointment.setPrep(new Prep(items));
        return view(appointments.save(appointment));
    }

    @Transactional
    public AppointmentView removePrep(UUID id, String prepId) {
        FamilyContext context = directory.context();
        context.requireContributor();
        Appointment appointment = find(context, id);
        List<PrepItem> items = appointment.getPrep().itemsOrEmpty().stream().filter(item -> !item.id().equals(prepId)).toList();
        appointment.setPrep(new Prep(new ArrayList<>(items)));
        return view(appointments.save(appointment));
    }

    /**
     * A member left the family (called by the event listener, so there is no caller): visits for them go
     * with them, and visits they were going along to lose their escort.
     */
    @Transactional
    public void memberLeft(UUID familyId, UUID memberId) {
        List<Appointment> escorted = appointments.findByFamilyIdAndEscortId(familyId, memberId).stream().filter(appointment -> !memberId.equals(appointment.getForId())).toList();
        for (Appointment appointment : appointments.findByFamilyIdAndForId(familyId, memberId)) {
            delete(appointment);
            // No audit or notification: leaving the family is what the family was told about. Other services only need to unlink.
            events.publish(Topics.CARE, describe(Events.of("appointment.removed", familyId, null), appointment).build());
        }
        for (Appointment appointment : escorted) {
            appointment.setEscortId(null);
        }
        appointments.saveAll(escorted);
    }

    /**
     * An approved handover of a shared task that belongs to a visit: whoever took the task now goes
     * along. Not when the new owner is the person the visit is for, who does not escort themselves.
     */
    @Transactional
    public void followTask(UUID familyId, UUID appointmentId, UUID assigneeId) {
        appointments.findByIdAndFamilyId(appointmentId, familyId).ifPresent(appointment -> {
            if (!assigneeId.equals(appointment.getForId()) && !assigneeId.equals(appointment.getEscortId())) {
                appointment.setEscortId(assigneeId);
                appointments.save(appointment);
            }
        });
    }

    private Optional<Appointment> findVisible(FamilyContext context, UUID id) {
        return appointments.findByIdAndFamilyId(id, context.familyId()).filter(appointment -> canSee(appointment, context));
    }

    /** A private visit the caller may not see is "not found", never "forbidden", so its existence is not revealed. */
    private Appointment find(FamilyContext context, UUID id) {
        return findVisible(context, id).orElseThrow(() -> ApiException.notFound("That appointment"));
    }

    /** The visit is for them, they go along, or they wrote it down. A shared visit is for everyone. */
    static boolean canSee(Appointment appointment, FamilyContext context) {
        UUID me = context.memberId();
        return appointment.isShared() || me.equals(appointment.getForId()) || me.equals(appointment.getEscortId()) || me.equals(appointment.getCreatedById());
    }

    /** Deletes the visit and unlinks the documents that pointed to it. */
    private void delete(Appointment appointment) {
        appointments.delete(appointment);
        List<CareDocument> linked = documents.findByFamilyIdAndAppointmentId(appointment.getFamilyId(), appointment.getId());
        for (CareDocument document : linked) {
            document.setAppointmentId(null);
        }
        documents.saveAll(linked);
    }

    private void requirePeople(AppointmentInput input) {
        if (!People.exists(directory, input.forId())) {
            throw ApiException.unprocessable("Choose who the appointment is for.");
        }
        if (input.escortId() != null && !People.isMember(directory, input.escortId())) {
            throw ApiException.unprocessable("That person is not in your family.");
        }
    }

    private static void apply(Appointment appointment, AppointmentInput input, FamilyContext context) {
        appointment.setTitle(input.title().trim());
        appointment.setSpecialty(Formats.trim(input.specialty()));
        appointment.setStartAt(input.start());
        appointment.setDurationMin(input.durationMin());
        appointment.setProvider(Formats.trim(input.provider()));
        appointment.setLocation(Formats.trim(input.location()));
        appointment.setForId(input.forId());
        appointment.setEscortId(input.escortId());
        appointment.setVisibility(input.visibility());
        appointment.setNote(Formats.trim(input.note()));
        appointment.setTimezone(context.zone().getId());
    }

    /** The ids other services react to. Present on private visits too: they carry no names or titles. */
    private static Events describe(Events event, Appointment appointment) {
        return event
                .data("appointmentId", appointment.getId())
                .data("escortId", appointment.getEscortId())
                .data("forId", appointment.getForId())
                .data("visibility", appointment.getVisibility());
    }

    /** Tells the member who was asked to go along. Not the caller, who already knows. */
    private void askToGoAlong(Events event, FamilyContext context, Appointment appointment) {
        UUID escort = appointment.getEscortId();
        if (escort == null || escort.equals(context.memberId())) {
            return;
        }
        event.notifyMember(
                escort,
                "appointment",
                Names.first(context.memberName()) + " asked you to go along to “" + appointment.getTitle() + "” with " + People.firstName(directory, appointment.getForId())
                        + " (" + Formats.dayTime(appointment.getStartAt(), context.zone()) + ").",
                "/appointments/" + appointment.getId());
    }

    static AppointmentView view(Appointment appointment) {
        List<PrepItemView> prep = appointment.getPrep().itemsOrEmpty().stream().map(item -> new PrepItemView(item.id(), item.label(), item.done(), item.doneById())).toList();
        return new AppointmentView(
                appointment.getId(),
                appointment.getTitle(),
                appointment.getSpecialty(),
                appointment.getStartAt(),
                appointment.getDurationMin(),
                appointment.getProvider(),
                appointment.getLocation(),
                appointment.getForId(),
                appointment.getEscortId(),
                appointment.getVisibility(),
                prep,
                appointment.getNote(),
                appointment.getCreatedById(),
                appointment.getCreatedAt());
    }

    /** What decision-service may know about a private visit it is not part of: that someone is busy, not why. */
    private static AppointmentView masked(Appointment appointment) {
        return new AppointmentView(
                appointment.getId(),
                "",
                "",
                appointment.getStartAt(),
                appointment.getDurationMin(),
                "",
                "",
                appointment.getForId(),
                appointment.getEscortId(),
                appointment.getVisibility(),
                List.of(),
                "",
                appointment.getCreatedById(),
                appointment.getCreatedAt());
    }
}
