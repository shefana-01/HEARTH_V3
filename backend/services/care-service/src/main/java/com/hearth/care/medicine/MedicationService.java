package com.hearth.care.medicine;

import com.hearth.care.medicine.MedicineDtos.DoseInput;
import com.hearth.care.medicine.MedicineDtos.DoseView;
import com.hearth.care.medicine.MedicineDtos.MedicationInput;
import com.hearth.care.medicine.MedicineDtos.MedicationView;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Medicine schedules and the doses taken. Visibility follows health notes ({@link HealthAccess}); the carer
 * of a medicine also sees it and can mark doses. Hearth reminds and records, it never advises on medicine.
 */
@Service
public class MedicationService {

    /** A dose counts as "due" from its time until an hour later; after that, unmarked means missed. */
    public static final Duration GRACE = Duration.ofMinutes(60);
    static final Duration MAX_RANGE = Duration.ofDays(62);
    /** Doses can be marked up to a week late (someone forgot to tick it), and up to two hours early. */
    static final Duration RECORD_BACK = Duration.ofDays(7);
    static final Duration RECORD_AHEAD = Duration.ofHours(2);

    private final FamilyDirectory directory;
    private final HealthAccess access;
    private final MedicationRepository medications;
    private final MedicationDoseRepository doses;
    private final EventPublisher events;
    private final Clock clock;

    public MedicationService(FamilyDirectory directory, HealthAccess access, MedicationRepository medications, MedicationDoseRepository doses, EventPublisher events, Clock clock) {
        this.directory = directory;
        this.access = access;
        this.medications = medications;
        this.doses = doses;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MedicationView> list(UUID personId) {
        FamilyContext context = directory.context();
        return visible(context).stream().filter(m -> personId == null || m.getPersonId().equals(personId)).map(MedicationService::view).toList();
    }

    @Transactional
    public MedicationView create(MedicationInput input) {
        FamilyContext context = directory.context();
        checkPerson(context, input.personId());
        Medication medication = new Medication(context.familyId(), input.personId(), context.memberId(), Instant.now(clock));
        apply(context, medication, input);
        medications.save(medication);
        publish(context, medication, "Added a medicine schedule", true);
        return view(medication);
    }

    @Transactional
    public MedicationView update(UUID id, MedicationInput input) {
        FamilyContext context = directory.context();
        Medication medication = find(context, id);
        if (!medication.getPersonId().equals(input.personId())) {
            throw ApiException.unprocessable("A medicine stays with the person who takes it. Add a new one for someone else.");
        }
        if (!access.canEdit(context, medication.getPersonId())) {
            throw ApiException.forbidden("You can view this medicine but not change it.");
        }
        UUID carerBefore = medication.getCarerId();
        apply(context, medication, input);
        medication.touch(Instant.now(clock));
        medications.save(medication);
        publish(context, medication, "Changed a medicine schedule", !Objects.equals(carerBefore, medication.getCarerId()));
        return view(medication);
    }

    @Transactional
    public void delete(UUID id) {
        FamilyContext context = directory.context();
        Medication medication = find(context, id);
        if (!access.canEdit(context, medication.getPersonId())) {
            throw ApiException.forbidden("You can view this medicine but not change it.");
        }
        medications.delete(medication);
        Events event = Events.of(EventTypes.MEDICATION_REMOVED, context).data("medicationId", medication.getId()).data("personId", medication.getPersonId());
        if (People.isDependant(directory, medication.getPersonId())) {
            event.audit("care", "Removed a medicine schedule", People.name(directory, medication.getPersonId()));
        }
        events.publish(Topics.CARE, event.build());
    }

    /** Scheduled doses in [from, to] with what happened to each, earliest first. */
    @Transactional(readOnly = true)
    public List<DoseView> doses(Instant from, Instant to, UUID personId) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw ApiException.badRequest("Choose a time range.");
        }
        if (Duration.between(from, to).compareTo(MAX_RANGE) > 0) {
            throw ApiException.badRequest("Ask for at most 62 days at a time.");
        }
        FamilyContext context = directory.context();
        List<Medication> meds = visible(context).stream().filter(m -> personId == null || m.getPersonId().equals(personId)).toList();
        if (meds.isEmpty()) {
            return List.of();
        }
        Map<String, MedicationDose> recorded = doses.findByMedicationIdInAndScheduledAtBetween(meds.stream().map(Medication::getId).toList(), from, to).stream()
                .collect(Collectors.toMap(d -> d.getMedicationId() + "@" + d.getScheduledAt(), Function.identity(), (a, b) -> a));
        Instant now = Instant.now(clock);
        List<DoseView> out = new ArrayList<>();
        for (Medication m : meds) {
            for (Instant slot : Schedule.slots(m, from, to)) {
                MedicationDose dose = recorded.get(m.getId() + "@" + slot);
                if (dose == null && !m.isActive()) {
                    // A paused medicine asks for nothing; only what was already recorded is shown.
                    continue;
                }
                String status = dose != null ? dose.getStatus() : slot.isAfter(now) ? "upcoming" : slot.plus(GRACE).isAfter(now) ? "due" : MedicationDose.MISSED;
                out.add(new DoseView(m.getId(), m.getPersonId(), m.getName(), m.getDose(), m.getInstructions(), slot, status,
                        dose == null ? null : dose.getRecordedBy(), dose == null ? null : dose.getRecordedAt()));
            }
        }
        out.sort(Comparator.comparing(DoseView::scheduledAt).thenComparing(DoseView::name));
        return out;
    }

    @Transactional
    public DoseView record(UUID id, DoseInput input) {
        FamilyContext context = directory.context();
        Medication medication = find(context, id);
        boolean self = medication.getPersonId().equals(context.memberId());
        if (!self && (context.isObserver() || !access.canEdit(context, medication.getPersonId()) && !medication.involves(context.memberId()))) {
            throw ApiException.forbidden("You can view this medicine but not mark doses.");
        }
        Instant now = Instant.now(clock);
        Instant at = input.scheduledAt();
        if (!Schedule.isSlot(medication, at)) {
            throw ApiException.unprocessable("No dose of this medicine is planned at that time.");
        }
        if (at.isAfter(now.plus(RECORD_AHEAD)) || at.isBefore(now.minus(RECORD_BACK))) {
            throw ApiException.unprocessable("Doses can be marked from two hours before until a week after their time.");
        }
        MedicationDose dose = doses.findByMedicationIdAndScheduledAt(medication.getId(), at).orElseGet(() -> new MedicationDose(context.familyId(), medication.getId(), at));
        dose.record(input.status(), context.memberId(), now);
        doses.save(dose);
        events.publish(Topics.CARE, Events.of(EventTypes.MEDICATION_DOSE_RECORDED, context).data("medicationId", medication.getId()).data("scheduledAt", at.toString()).build());
        return new DoseView(medication.getId(), medication.getPersonId(), medication.getName(), medication.getDose(), medication.getInstructions(), at, dose.getStatus(), context.memberId(), now);
    }

    /** Someone left the family (or a dependant was removed): their medicines go, and they stop being anyone's carer. */
    @Transactional
    public void personLeft(UUID familyId, UUID personId) {
        if (personId == null) {
            return;
        }
        medications.deleteAll(medications.findByFamilyIdAndPersonId(familyId, personId));
        for (Medication m : medications.findByFamilyIdAndCarerId(familyId, personId)) {
            m.setCarerId(null);
        }
    }

    /* ───────── helpers ───────── */

    private List<Medication> visible(FamilyContext context) {
        return medications.findByFamilyIdOrderByCreatedAtAsc(context.familyId()).stream()
                .filter(m -> m.involves(context.memberId()) || access.canSee(context, m.getPersonId()))
                .toList();
    }

    private Medication find(FamilyContext context, UUID id) {
        Medication m = medications.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That medicine"));
        if (!m.involves(context.memberId()) && !access.canSee(context, m.getPersonId())) {
            throw ApiException.notFound("That medicine");
        }
        return m;
    }

    private void checkPerson(FamilyContext context, UUID personId) {
        if (!People.exists(directory, personId)) {
            throw ApiException.notFound("That person");
        }
        if (!access.canEdit(context, personId)) {
            throw ApiException.forbidden("You can add medicines for yourself, or for someone the family looks after if you have medical access.");
        }
    }

    private void apply(FamilyContext context, Medication m, MedicationInput input) {
        List<String> times = input.times().stream().map(t -> LocalTime.parse(t).toString()).distinct().sorted().toList();
        if (input.days().stream().noneMatch(Boolean.TRUE::equals)) {
            throw ApiException.unprocessable("Choose at least one day.");
        }
        LocalDate end = input.endDate();
        if (end != null && end.isBefore(input.startDate())) {
            throw ApiException.unprocessable("The last day can’t be before the first day.");
        }
        UUID carer = input.carerId();
        if (carer != null) {
            MemberRef member = directory.members().stream().filter(r -> r.id().equals(carer)).findFirst()
                    .orElseThrow(() -> ApiException.unprocessable("Choose a family member to help with it."));
            if (!member.canTakeTasks()) {
                throw ApiException.unprocessable(member.firstName() + " can’t take on care tasks in Hearth.");
            }
        }
        boolean dependant = People.isDependant(directory, m.getPersonId());
        if (input.reminders() && dependant && carer == null) {
            throw ApiException.unprocessable("Choose who helps with it, so someone gets the reminders.");
        }
        m.setName(Formats.trim(input.name()));
        m.setDose(Formats.trim(input.dose()) == null ? "" : Formats.trim(input.dose()));
        m.setInstructions(Formats.trim(input.instructions()) == null ? "" : Formats.trim(input.instructions()));
        m.setTimes(times);
        m.setDays(input.days());
        m.setStartDate(input.startDate());
        m.setEndDate(end);
        m.setCarerId(carer);
        m.setReminders(input.reminders());
        m.setActive(input.active() == null || input.active());
        m.setTimezone(context.zone().getId());
    }

    private void publish(FamilyContext context, Medication m, String action, boolean tellCarer) {
        Events event = Events.of(EventTypes.MEDICATION_UPDATED, context).data("medicationId", m.getId()).data("personId", m.getPersonId());
        // Medicines of people the family looks after are part of the family's care; a member's own stay out of the log.
        if (People.isDependant(directory, m.getPersonId())) {
            event.audit("care", action, People.name(directory, m.getPersonId()));
        }
        if (tellCarer && m.getCarerId() != null && !m.getCarerId().equals(context.memberId())) {
            event.notifyMember(m.getCarerId(), "reminder",
                    Formats.trim(context.memberName()).split(" ")[0] + " asked you to help " + People.firstName(directory, m.getPersonId()) + " with " + m.getName()
                            + " at " + String.join(", ", m.getTimes()) + ".", "/health/medicines");
        }
        events.publish(Topics.CARE, event.build());
    }

    static MedicationView view(Medication m) {
        return new MedicationView(m.getId(), m.getPersonId(), m.getName(), m.getDose(), m.getInstructions(), List.copyOf(m.getTimes()), List.copyOf(m.getDays()),
                m.getStartDate(), m.getEndDate(), m.getCarerId(), m.isReminders(), m.isActive(), m.getCreatedBy(), m.getUpdatedAt());
    }
}
