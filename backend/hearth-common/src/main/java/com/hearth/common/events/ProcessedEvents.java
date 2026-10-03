package com.hearth.common.events;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes a consumer idempotent. Kafka can deliver a message more than once, so a
 * consumer records each event id in its own database, in the same transaction
 * as the work it does, and skips ids it has already seen.
 */
@Component
public class ProcessedEvents {

    private final JdbcTemplate jdbc;

    public ProcessedEvents(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** True the first time an event id is seen by this service; false for a repeat. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean firstTime(UUID eventId) {
        return jdbc.update("insert into processed_event (event_id, processed_at) values (?, now()) on conflict do nothing", eventId) == 1;
    }
}
