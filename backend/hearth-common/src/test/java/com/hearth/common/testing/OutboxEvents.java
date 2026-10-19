package com.hearth.common.testing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.events.DomainEvent;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/** Reads the events a service wrote to its outbox (tests run without Kafka). */
public final class OutboxEvents {

    private OutboxEvents() {
    }

    public static List<DomainEvent> all(JdbcTemplate jdbc, ObjectMapper mapper) {
        return jdbc.queryForList("select payload from outbox_event order by created_at", String.class).stream().map(payload -> read(mapper, payload)).toList();
    }

    public static List<DomainEvent> ofType(JdbcTemplate jdbc, ObjectMapper mapper, String type) {
        return jdbc.queryForList("select payload from outbox_event where event_type = ? order by created_at", String.class, type).stream().map(payload -> read(mapper, payload)).toList();
    }

    public static DomainEvent last(JdbcTemplate jdbc, ObjectMapper mapper, String type) {
        List<DomainEvent> events = ofType(jdbc, mapper, type);
        if (events.isEmpty()) {
            throw new AssertionError("No " + type + " event was published");
        }
        return events.get(events.size() - 1);
    }

    private static DomainEvent read(ObjectMapper mapper, String payload) {
        try {
            return mapper.readValue(payload, DomainEvent.class);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
