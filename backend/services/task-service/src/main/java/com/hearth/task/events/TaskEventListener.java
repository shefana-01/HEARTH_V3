package com.hearth.task.events;

import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.ProcessedEvents;
import com.hearth.common.events.Topics;
import com.hearth.task.domain.Task;
import com.hearth.task.repository.PersonalEventRepository;
import com.hearth.task.repository.TaskRepository;
import com.hearth.task.repository.UnavailabilityRepository;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps tasks consistent with changes made in other services:
 * <ul>
 *   <li>a member leaves: their private tasks, events and time away go; shared tasks they had go back to
 *       "needs someone"; tasks for them lose that link;</li>
 *   <li>someone the family looked after is removed: tasks for them lose that link;</li>
 *   <li>an appointment is removed: tasks linked to it lose the link;</li>
 *   <li>an appointment gets someone going along: the shared tasks linked to it follow that person.</li>
 * </ul>
 * Each event is handled once, even if Kafka delivers it twice ({@link ProcessedEvents}).
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class TaskEventListener {

    private final EventReader reader;
    private final ProcessedEvents processed;
    private final TaskRepository tasks;
    private final PersonalEventRepository personalEvents;
    private final UnavailabilityRepository unavailability;

    public TaskEventListener(EventReader reader, ProcessedEvents processed, TaskRepository tasks, PersonalEventRepository personalEvents, UnavailabilityRepository unavailability) {
        this.reader = reader;
        this.processed = processed;
        this.tasks = tasks;
        this.personalEvents = personalEvents;
        this.unavailability = unavailability;
    }

    @KafkaListener(topics = {Topics.FAMILY, Topics.CARE})
    @Transactional
    public void on(String message) {
        DomainEvent event = reader.read(message);
        if (event == null || !processed.firstTime(event.eventId())) {
            return;
        }
        handle(event);
    }

    /** Public so tests can feed events without Kafka. */
    @Transactional
    public void handle(DomainEvent event) {
        UUID family = event.familyId();
        switch (event.type()) {
            case EventTypes.MEMBER_REMOVED -> memberLeft(family, event.uuid("memberId"));
            case EventTypes.DEPENDANT_REMOVED -> unlinkPerson(family, event.uuid("dependantId"));
            case EventTypes.APPOINTMENT_REMOVED -> {
                for (Task task : tasks.findByFamilyIdAndAppointmentId(family, event.uuid("appointmentId"))) {
                    task.setAppointmentId(null);
                }
            }
            case EventTypes.APPOINTMENT_UPDATED -> followEscort(family, event.uuid("appointmentId"), event.uuid("escortId"));
            default -> {
                // Not relevant to tasks.
            }
        }
    }

    private void memberLeft(UUID family, UUID memberId) {
        if (memberId == null) {
            return;
        }
        for (Task task : tasks.findByFamilyIdAndAssigneeId(family, memberId)) {
            if (!task.isShared()) {
                tasks.delete(task);
            } else if (task.isScheduled()) {
                task.setAssigneeId(null);
                task.setAcknowledgedConflict(null);
            }
        }
        unlinkPerson(family, memberId);
        personalEvents.deleteByFamilyIdAndMemberId(family, memberId);
        unavailability.deleteByFamilyIdAndMemberId(family, memberId);
    }

    private void unlinkPerson(UUID family, UUID personId) {
        if (personId == null) {
            return;
        }
        for (Task task : tasks.findByFamilyIdAndForId(family, personId)) {
            task.setForId(null);
        }
    }

    /** A task linked to the visit ("drive to the clinic") follows whoever is going along. */
    private void followEscort(UUID family, UUID appointmentId, UUID escortId) {
        if (appointmentId == null || escortId == null) {
            return;
        }
        for (Task task : tasks.findByFamilyIdAndAppointmentId(family, appointmentId)) {
            if (task.isShared() && task.isScheduled() && !escortId.equals(task.getAssigneeId())) {
                task.setAssigneeId(escortId);
                task.setAcknowledgedConflict(null);
            }
        }
    }
}
