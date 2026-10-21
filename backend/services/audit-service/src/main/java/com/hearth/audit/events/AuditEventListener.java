package com.hearth.audit.events;

import com.hearth.audit.entity.AuditEvent;
import com.hearth.audit.repository.AuditEventRepository;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.DomainEvent.AuditInfo;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.Topics;
import com.hearth.common.text.Formats;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes the activity-log line an event carries. The event id is unique in the table, so a message Kafka
 * delivers twice is logged once. Rows are never changed or deleted afterwards.
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class AuditEventListener {

    private static final Set<String> CATEGORIES = Set.of("tasks", "schedule", "care", "circle");

    private final EventReader reader;
    private final AuditEventRepository events;

    public AuditEventListener(EventReader reader, AuditEventRepository events) {
        this.reader = reader;
        this.events = events;
    }

    @KafkaListener(topics = {Topics.FAMILY, Topics.TASK, Topics.DECISION, Topics.CARE})
    @Transactional
    public void on(String message) {
        DomainEvent event = reader.read(message);
        if (event != null) {
            handle(event);
        }
    }

    /** Public so tests can feed events without Kafka. */
    @Transactional
    public void handle(DomainEvent event) {
        AuditInfo audit = event.audit();
        if (audit == null || audit.action() == null || !CATEGORIES.contains(audit.category()) || events.existsByEventId(event.eventId())) {
            return;
        }
        AuditEvent row = new AuditEvent();
        row.setId(UUID.randomUUID());
        row.setFamilyId(event.familyId());
        row.setActorId(event.actorMemberId());
        row.setCategory(audit.category());
        row.setAction(Formats.clip(audit.action(), 120));
        row.setSubject(Formats.clip(audit.subject() == null ? "" : audit.subject(), 300));
        row.setBeforeValue(audit.before() == null ? null : Formats.clip(audit.before(), 500));
        row.setAfterValue(audit.after() == null ? null : Formats.clip(audit.after(), 500));
        row.setOccurredAt(event.occurredAt());
        row.setEventType(event.type());
        row.setEventId(event.eventId());
        try {
            events.saveAndFlush(row);
        } catch (DataIntegrityViolationException ex) {
            // Logged a moment ago by a second delivery of the same event.
        }
    }
}
