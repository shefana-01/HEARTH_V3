package com.hearth.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One line of the activity log: who did what, to what, and when. */
@Entity
@Table(name = "audit_event")
public class AuditEvent {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String subject;

    @Column(name = "before_value")
    private String beforeValue;

    @Column(name = "after_value")
    private String afterValue;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "event_id", nullable = false, unique = true)
    private UUID eventId;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getFamilyId() { return familyId; }
    public void setFamilyId(UUID familyId) { this.familyId = familyId; }
    public UUID getActorId() { return actorId; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBeforeValue() { return beforeValue; }
    public void setBeforeValue(String beforeValue) { this.beforeValue = beforeValue; }
    public String getAfterValue() { return afterValue; }
    public void setAfterValue(String afterValue) { this.afterValue = afterValue; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public UUID getEventId() { return eventId; }
    public void setEventId(UUID eventId) { this.eventId = eventId; }
}
