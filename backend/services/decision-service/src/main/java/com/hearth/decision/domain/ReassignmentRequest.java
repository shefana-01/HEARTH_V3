package com.hearth.decision.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/** A request to hand a shared task over to someone else ("Who can take it?"). */
@Entity
@Table(name = "reassignment_request")
public class ReassignmentRequest {

    public static final String OPEN = "open";
    public static final String APPROVED = "approved";
    public static final String CANCELLED = "cancelled";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "from_member_id")
    private UUID fromMemberId;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String note = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

    @Column(nullable = false)
    private String status = OPEN;

    @Column(name = "approved_member_id")
    private UUID approvedMemberId;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Version
    private long version;

    protected ReassignmentRequest() {
    }

    public ReassignmentRequest(UUID familyId, UUID taskId, UUID fromMemberId, String reason, String note, UUID createdById) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.taskId = taskId;
        this.fromMemberId = fromMemberId;
        this.reason = reason;
        this.note = note;
        this.createdById = createdById;
        this.createdAt = Instant.now();
    }

    public boolean isOpen() {
        return OPEN.equals(status);
    }

    public void approve(UUID memberId) {
        status = APPROVED;
        approvedMemberId = memberId;
        resolvedAt = Instant.now();
    }

    public void cancel() {
        status = CANCELLED;
        resolvedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getTaskId() {
        return taskId;
    }

    public UUID getFromMemberId() {
        return fromMemberId;
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

    public UUID getCreatedById() {
        return createdById;
    }

    public String getStatus() {
        return status;
    }

    public UUID getApprovedMemberId() {
        return approvedMemberId;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }
}
