package com.hearth.common.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Something that happened in one family, published to Kafka through the outbox.
 *
 * @param eventId       unique id; consumers use it to ignore an event they already handled
 * @param type          e.g. {@code task.created}, {@code unavailability.reported} (see {@link EventTypes})
 * @param actorMemberId the member who caused it (null for things Hearth does by itself, like reminders)
 * @param audit         the line to record in the family's activity log, if any (audit-service)
 * @param notification  the in-app notification to raise, if any (notification-service)
 * @param chat          a line to add to a chat channel, if any (notification-service)
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
        ChatInfo chat,
        Map<String, Object> data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AuditInfo(String category, String action, String subject, String before, String after) {
    }

    /**
     * @param recipientId only this member sees it; null = the whole family except whoever caused it
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NotificationInfo(String type, String message, String href, UUID recipientId) {
    }

    /**
     * @param channel  {@code family} or {@code task:<id>}
     * @param kind     {@code system} (Hearth noting a change) or {@code status} (someone's status line)
     * @param authorId null for system lines
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChatInfo(String channel, String kind, String text, UUID authorId) {
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

    /** A list of ids from {@link #data} (sent as a JSON array of strings), or an empty list. */
    public List<UUID> uuids(String key) {
        Object value = data == null ? null : data.get(key);
        if (!(value instanceof Collection<?> items)) {
            return List.of();
        }
        return items.stream().filter(Objects::nonNull).map(item -> UUID.fromString(item.toString())).toList();
    }
}
