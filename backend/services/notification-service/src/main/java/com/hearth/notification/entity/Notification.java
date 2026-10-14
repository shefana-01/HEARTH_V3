package com.hearth.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification")
public class Notification {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String message;

    private String href;

    @Column(name = "actor_member_id")
    private UUID actorMemberId;

    /** Only this member sees the notification; null means the whole family except the actor. */
    @Column(name = "recipient_member_id")
    private UUID recipientMemberId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "event_id", nullable = false, unique = true)
    private UUID eventId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public void setFamilyId(UUID familyId) {
        this.familyId = familyId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getHref() {
        return href;
    }

    public void setHref(String href) {
        this.href = href;
    }

    public UUID getActorMemberId() {
        return actorMemberId;
    }

    public void setActorMemberId(UUID actorMemberId) {
        this.actorMemberId = actorMemberId;
    }

    public UUID getRecipientMemberId() {
        return recipientMemberId;
    }

    public void setRecipientMemberId(UUID recipientMemberId) {
        this.recipientMemberId = recipientMemberId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public UUID getEventId() {
        return eventId;
    }

    public void setEventId(UUID eventId) {
        this.eventId = eventId;
    }
}
