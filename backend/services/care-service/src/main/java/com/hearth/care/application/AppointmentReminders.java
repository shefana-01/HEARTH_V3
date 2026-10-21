package com.hearth.care.application;

import com.hearth.care.domain.Appointment;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.text.Formats;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Once a minute, reminds the people involved in a visit that starts within the hour: the person it is for
 * (if they use Hearth) and whoever goes along. Each visit is reminded about once; moving it resets that.
 */
@Component
public class AppointmentReminders {

    static final Duration LEAD_TIME = Duration.ofMinutes(60);

    private final AppointmentRepository appointments;
    private final EventPublisher events;

    public AppointmentReminders(AppointmentRepository appointments, EventPublisher events) {
        this.appointments = appointments;
        this.events = events;
    }

    @Scheduled(fixedDelayString = "${hearth.reminders.poll-ms:60000}", initialDelayString = "PT25S")
    @Transactional
    public void raiseDueReminders() {
        Instant now = Instant.now();
        for (Appointment appointment : appointments.findDueReminders(now, now.plus(LEAD_TIME))) {
            appointment.setReminderSentAt(now);
            try {
                appointments.saveAndFlush(appointment);
            } catch (ObjectOptimisticLockingFailureException ex) {
                continue;
            }
            String message = appointment.getTitle() + " — appointment at " + Formats.time(appointment.getStartAt(), zone(appointment))
                    + (appointment.getLocation().isBlank() ? "" : ", " + appointment.getLocation()) + ".";
            // The person it is for (ignored by notification-service if they are a dependant, who has no account) and the escort.
            Set<UUID> people = new LinkedHashSet<>();
            people.add(appointment.getForId());
            if (appointment.getEscortId() != null) {
                people.add(appointment.getEscortId());
            }
            for (UUID person : people) {
                events.publish(Topics.CARE, Events.of(EventTypes.APPOINTMENT_REMINDER, appointment.getFamilyId(), null)
                        .notifyMember(person, "reminder", message, "/appointments/" + appointment.getId())
                        .data("appointmentId", appointment.getId())
                        .build());
            }
        }
    }

    private static ZoneId zone(Appointment appointment) {
        try {
            return ZoneId.of(appointment.getTimezone());
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }
}
