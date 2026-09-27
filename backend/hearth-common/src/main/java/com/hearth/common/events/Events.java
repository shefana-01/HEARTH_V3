package com.hearth.common.events;

import com.hearth.common.events.DomainEvent.AuditInfo;
import com.hearth.common.events.DomainEvent.NotificationInfo;
import com.hearth.common.family.FamilyContext;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Small builder so services can describe an event in one readable statement. */
public final class Events {

    private final String type;
    private final UUID familyId;
    private final UUID actorMemberId;
    private AuditInfo audit;
    private NotificationInfo notification;
    private final Map<String, Object> data = new LinkedHashMap<>();

    private Events(String type, UUID familyId, UUID actorMemberId) {
        this.type = type;
        this.familyId = familyId;
        this.actorMemberId = actorMemberId;
    }

    public static Events of(String type, FamilyContext context) {
        return new Events(type, context.familyId(), context.memberId());
    }

    public static Events of(String type, UUID familyId, UUID actorMemberId) {
        return new Events(type, familyId, actorMemberId);
    }

    public Events audit(String category, String action, String subject) {
        return audit(category, action, subject, null, null);
    }

    public Events audit(String category, String action, String subject, String before, String after) {
        this.audit = new AuditInfo(category, action, subject, before, after);
        return this;
    }

    public Events notify(String type, String message, String href) {
        this.notification = new NotificationInfo(type, message, href);
        return this;
    }

    /** Values are stored as text or plain JSON values. Null values are left out. */
    public Events data(String key, Object value) {
        if (value != null) {
            data.put(key, value instanceof UUID || value instanceof Instant ? value.toString() : value);
        }
        return this;
    }

    public DomainEvent build() {
        return new DomainEvent(UUID.randomUUID(), type, Instant.now(), familyId, actorMemberId, audit, notification, data);
    }
}
