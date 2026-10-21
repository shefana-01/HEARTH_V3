package com.hearth.care.events;

import com.hearth.care.application.AppointmentService;
import com.hearth.care.application.DocumentService;
import com.hearth.care.application.GroceryService;
import com.hearth.care.application.HealthService;
import com.hearth.care.graph.CareGraphService;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.ProcessedEvents;
import com.hearth.common.events.Topics;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps care data consistent with changes made elsewhere:
 * <ul>
 *   <li>a member leaves: visits for them go, visits they escorted lose the escort, their health notes go,
 *       documents about them become household documents, their name comes off the shopping list;</li>
 *   <li>someone the family looked after is removed: the same for their notes, documents and list entries;</li>
 *   <li>a handover of a task linked to a visit is approved: the new owner goes along to the visit;</li>
 *   <li>anything shown on the family map changes: the map is rebuilt on its next look.</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class CareEventListener {

    /** Events that change who or what appears on the family map. */
    private static final Set<String> MAP_CHANGES = Set.of(
            EventTypes.FAMILY_CREATED, EventTypes.FAMILY_UPDATED, EventTypes.MEMBER_JOINED, EventTypes.MEMBER_UPDATED, EventTypes.MEMBER_REMOVED,
            EventTypes.DEPENDANT_ADDED, EventTypes.DEPENDANT_UPDATED, EventTypes.DEPENDANT_REMOVED,
            EventTypes.TASK_CREATED, EventTypes.TASK_UPDATED, EventTypes.TASK_COMPLETED, EventTypes.TASK_REOPENED, EventTypes.TASK_CANCELLED,
            EventTypes.TASK_MADE_PRIVATE, EventTypes.TASK_ASSIGNED, EventTypes.HANDOVER_APPROVED, EventTypes.PLAN_CHANGED,
            EventTypes.APPOINTMENT_CREATED, EventTypes.APPOINTMENT_UPDATED, EventTypes.APPOINTMENT_REMOVED);

    private final EventReader reader;
    private final ProcessedEvents processed;
    private final AppointmentService appointments;
    private final DocumentService documents;
    private final HealthService health;
    private final GroceryService groceries;
    private final CareGraphService graph;

    public CareEventListener(EventReader reader, ProcessedEvents processed, AppointmentService appointments, DocumentService documents, HealthService health, GroceryService groceries, CareGraphService graph) {
        this.reader = reader;
        this.processed = processed;
        this.appointments = appointments;
        this.documents = documents;
        this.health = health;
        this.groceries = groceries;
        this.graph = graph;
    }

    @KafkaListener(topics = {Topics.FAMILY, Topics.TASK, Topics.DECISION, Topics.CARE})
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
            case EventTypes.MEMBER_REMOVED -> {
                UUID member = event.uuid("memberId");
                appointments.memberLeft(family, member);
                personLeft(family, member);
            }
            case EventTypes.DEPENDANT_REMOVED -> personLeft(family, event.uuid("dependantId"));
            case EventTypes.HANDOVER_APPROVED -> {
                UUID appointmentId = event.uuid("appointmentId");
                if (appointmentId != null) {
                    appointments.followTask(family, appointmentId, event.uuid("memberId"));
                }
            }
            default -> {
                // Nothing else to tidy up.
            }
        }
        if (MAP_CHANGES.contains(event.type())) {
            graph.markChanged(family);
        }
    }

    private void personLeft(UUID family, UUID personId) {
        if (personId == null) {
            return;
        }
        health.personLeft(family, personId);
        documents.personLeft(family, personId);
        groceries.personLeft(family, personId);
    }
}
