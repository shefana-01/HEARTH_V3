package com.hearth.task.calendar;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A member's private calendar address. The token itself is never stored, only its SHA-256. */
@Entity
@Table(name = "calendar_feed")
public class CalendarFeed {

    @Id
    @Column(name = "member_id")
    private UUID memberId;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private String timezone;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_fetched_at")
    private Instant lastFetchedAt;

    protected CalendarFeed() {
    }

    public CalendarFeed(UUID memberId, UUID familyId, String tokenHash, String label, String timezone, Instant createdAt) {
        this.memberId = memberId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.label = label;
        this.timezone = timezone;
        this.createdAt = createdAt;
    }

    /** A new address: the old one stops working at once. */
    public void rotate(String tokenHash, String label, String timezone, Instant at) {
        this.tokenHash = tokenHash;
        this.label = label;
        this.timezone = timezone;
        this.createdAt = at;
        this.lastFetchedAt = null;
    }

    public void fetched(Instant at) {
        this.lastFetchedAt = at;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public String getLabel() {
        return label;
    }

    public String getTimezone() {
        return timezone;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastFetchedAt() {
        return lastFetchedAt;
    }
}
