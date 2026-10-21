package com.hearth.task.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Time someone told the family they cannot cover ("I can't make it"). */
@Entity
@Table(name = "unavailability")
public class Unavailability {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(nullable = false)
    private String reason = "";

    @Column(nullable = false)
    private String note = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Unavailability() {
    }

    public Unavailability(UUID familyId, UUID memberId, Instant startAt, Instant endAt, String reason, String note) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.memberId = memberId;
        this.startAt = startAt;
        this.endAt = endAt;
        this.reason = reason;
        this.note = note;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public String getReason() {
        return reason;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
