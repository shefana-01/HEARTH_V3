package com.hearth.ai.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A member's agreement to send their requests to the AI provider. Removing the row withdraws it. */
@Entity
@Table(name = "ai_consent")
public class AiConsent {

    @Id
    @Column(name = "member_id")
    private UUID memberId;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    protected AiConsent() {
    }

    public AiConsent(UUID memberId, UUID familyId, Instant grantedAt) {
        this.memberId = memberId;
        this.familyId = familyId;
        this.grantedAt = grantedAt;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }
}
