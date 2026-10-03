package com.hearth.common.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional outbox, write side.
 *
 * The event is stored in the service's own database, in the same transaction
 * as the change it describes. So either both are saved or neither is: an event
 * is never lost and never sent for a change that was rolled back.
 * {@link OutboxRelay} then delivers the stored events to Kafka.
 */
@Component
@ConditionalOnProperty(name = "hearth.outbox.enabled", havingValue = "true")
public class EventPublisher {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public EventPublisher(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void publish(String topic, DomainEvent event) {
        String payload;
        try {
            payload = mapper.writeValueAsString(event);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialise event " + event.type(), ex);
        }
        jdbc.update(
                "insert into outbox_event (id, topic, event_key, event_type, payload, created_at) values (?, ?, ?, ?, ?, ?)",
                event.eventId(), topic, event.familyId().toString(), event.type(), payload, Timestamp.from(event.occurredAt()));
    }
}
