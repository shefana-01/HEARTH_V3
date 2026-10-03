package com.hearth.common.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Parses the JSON text of a Kafka message into a {@link DomainEvent}. */
@Component
public class EventReader {

    private static final Logger log = LoggerFactory.getLogger(EventReader.class);

    private final ObjectMapper mapper;

    public EventReader(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** Returns null for a message that is not a valid event, so one bad message cannot block the topic. */
    public DomainEvent read(String message) {
        try {
            DomainEvent event = mapper.readValue(message, DomainEvent.class);
            if (event == null || event.eventId() == null || event.type() == null || event.familyId() == null) {
                log.warn("Ignoring a message that is not a Hearth event");
                return null;
            }
            return event;
        } catch (Exception ex) {
            log.warn("Ignoring an unreadable message: {}", ex.getMessage());
            return null;
        }
    }
}
