package com.hearth.care.medicine;

import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.text.Formats;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Once a minute: "time for your medicine" when a dose comes due, and an alert when a dose was not marked
 * within an hour (then it is recorded as missed). Alerts go to the person (if they use Hearth) and to the
 * medicine's carer. Each alert is sent once, even with several instances running: the alert row is the lock.
 */
@Component
public class MedicationReminders {

    /** A dose that came due while the service was down for a few minutes is still announced. */
    static final Duration CATCH_UP = Duration.ofMinutes(10);
    /** Doses older than this are not announced as missed any more (after an outage, say). */
    static final Duration MISSED_LOOKBACK = Duration.ofHours(12);

    private final MedicationRepository medications;
    private final JdbcTemplate jdbc;
    private final EventPublisher events;
    private final Clock clock;

    public MedicationReminders(MedicationRepository medications, JdbcTemplate jdbc, EventPublisher events, Clock clock) {
        this.medications = medications;
        this.jdbc = jdbc;
        this.events = events;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${hearth.reminders.poll-ms:60000}", initialDelayString = "PT35S")
    @Transactional
    public void run() {
        Instant now = Instant.now(clock);
        for (Medication m : medications.findByActiveTrueAndRemindersTrue()) {
            for (Instant slot : Schedule.slots(m, now.minus(CATCH_UP), now)) {
                if (!recorded(m, slot) && claim(m, slot, "due", now)) {
                    String what = m.getName() + (m.getDose().isBlank() ? "" : " (" + m.getDose() + ")");
                    notify(m, EventTypes.MEDICATION_DUE, "Time for " + what + (m.getInstructions().isBlank() ? "" : " — " + m.getInstructions()) + ".", slot);
                }
            }
            for (Instant slot : Schedule.slots(m, now.minus(MISSED_LOOKBACK), now.minus(MedicationService.GRACE))) {
                if (recorded(m, slot) || !claim(m, slot, "missed", now)) {
                    continue;
                }
                jdbc.update("insert into medication_dose (id, family_id, medication_id, scheduled_at, status, recorded_by, recorded_at) values (?, ?, ?, ?, 'missed', null, ?) on conflict do nothing",
                        UUID.randomUUID(), m.getFamilyId(), m.getId(), Timestamp.from(slot), Timestamp.from(now));
                notify(m, EventTypes.MEDICATION_MISSED, "The " + Formats.time(slot, Schedule.zone(m.getTimezone())) + " dose of " + m.getName() + " wasn’t marked as taken.", slot);
            }
        }
    }

    private boolean recorded(Medication m, Instant slot) {
        Integer count = jdbc.queryForObject("select count(*) from medication_dose where medication_id = ? and scheduled_at = ?", Integer.class, m.getId(), Timestamp.from(slot));
        return count != null && count > 0;
    }

    /** True for the one caller that gets to send this alert. */
    private boolean claim(Medication m, Instant slot, String kind, Instant now) {
        return jdbc.update("insert into medication_alert (medication_id, scheduled_at, kind, sent_at) values (?, ?, ?, ?) on conflict do nothing",
                m.getId(), Timestamp.from(slot), kind, Timestamp.from(now)) == 1;
    }

    private void notify(Medication m, String type, String message, Instant slot) {
        // The person (ignored by notification-service when they are someone without an account) and the carer.
        Set<UUID> people = new LinkedHashSet<>();
        people.add(m.getPersonId());
        if (m.getCarerId() != null) {
            people.add(m.getCarerId());
        }
        for (UUID person : people) {
            events.publish(Topics.CARE, Events.of(type, m.getFamilyId(), null)
                    .notifyMember(person, "reminder", message, "/health/medicines")
                    .data("medicationId", m.getId())
                    .data("scheduledAt", slot.toString())
                    .build());
        }
    }
}
