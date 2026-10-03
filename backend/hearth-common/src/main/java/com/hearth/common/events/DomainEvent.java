package com.hearth.common.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Something that happened in one family, published to Kafka.
 *
 * @param eventId       unique id; consumers use it to ignore an event they already handled
 * @param type          e.g. {@code task.created}, {@code unavailability.reported}
 * @param actorMemberId the member who caused it (null for system events)
 * @param audit         the line to record in the activity log, if any
 * @param notification  the in-app notification to show the rest of the circle, if any
 * @param data          ids and values other services need to react
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DomainEvent(
        UUID eventId,
        String type,
        Instant occurredAt,
        UUID familyId,
        UUID actorMemberId,
        AuditInfo audit,
        NotificationInfo notification,
        Map<String, Object> data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AuditInfo(String category, String action, String subject, String before, String after) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NotificationInfo(String type, String message, String href) {
    }

    /** A value from {@link #data}, or null. */
    public String text(String key) {
        Object value = data == null ? null : data.get(key);
        return value == null ? null : value.toString();
    }

    public UUID uuid(String key) {
        String value = text(key);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }
}
