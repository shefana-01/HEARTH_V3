package com.hearth.care.medicine;

import com.hearth.care.medicine.MedicineDtos.EmergencyInput;
import com.hearth.care.medicine.MedicineDtos.EmergencyView;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The details on a person's emergency card: blood group, allergies, doctor, hospital. Same access as health notes. */
@Service
public class EmergencyService {

    private final FamilyDirectory directory;
    private final HealthAccess access;
    private final EmergencyInfoRepository info;
    private final EventPublisher events;
    private final Clock clock;

    public EmergencyService(FamilyDirectory directory, HealthAccess access, EmergencyInfoRepository info, EventPublisher events, Clock clock) {
        this.directory = directory;
        this.access = access;
        this.info = info;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public EmergencyView get(UUID personId) {
        FamilyContext context = directory.context();
        check(context, personId, false);
        return info.findByFamilyIdAndPersonId(context.familyId(), personId).map(EmergencyService::view)
                .orElseGet(() -> new EmergencyView(personId, "", "", "", "", "", "", null));
    }

    @Transactional
    public EmergencyView save(UUID personId, EmergencyInput input) {
        FamilyContext context = directory.context();
        check(context, personId, true);
        EmergencyInfo row = info.findByFamilyIdAndPersonId(context.familyId(), personId).orElseGet(() -> new EmergencyInfo(context.familyId(), personId));
        row.update(clean(input.bloodGroup()), clean(input.allergies()), clean(input.doctorName()), clean(input.doctorPhone()), clean(input.hospital()), clean(input.notes()),
                context.memberId(), Instant.now(clock));
        info.save(row);
        Events event = Events.of(EventTypes.EMERGENCY_INFO_UPDATED, context).data("personId", personId);
        if (People.isDependant(directory, personId)) {
            event.audit("care", "Updated the emergency card", People.name(directory, personId));
        }
        events.publish(Topics.CARE, event.build());
        return view(row);
    }

    @Transactional
    public void personLeft(UUID familyId, UUID personId) {
        if (personId != null) {
            info.deleteByFamilyIdAndPersonId(familyId, personId);
        }
    }

    private void check(FamilyContext context, UUID personId, boolean change) {
        if (!People.exists(directory, personId)) {
            throw ApiException.notFound("That person");
        }
        if (change ? !access.canEdit(context, personId) : !access.canSee(context, personId) && !access.canEdit(context, personId)) {
            throw ApiException.forbidden(change ? "You can only change your own emergency card, or that of someone the family looks after." : "This person keeps their health details private.");
        }
    }

    private static String clean(String value) {
        String trimmed = Formats.trim(value);
        return trimmed == null ? "" : trimmed;
    }

    static EmergencyView view(EmergencyInfo row) {
        return new EmergencyView(row.getPersonId(), row.getBloodGroup(), row.getAllergies(), row.getDoctorName(), row.getDoctorPhone(), row.getHospital(), row.getNotes(), row.getUpdatedAt());
    }
}
