package com.hearth.ai.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One request that reached the AI provider, with its token cost. */
@Entity
@Table(name = "ai_usage")
public class AiUsage {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(nullable = false)
    private String feature;

    @Column(name = "input_tokens", nullable = false)
    private int inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private int outputTokens;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AiUsage() {
    }

    public AiUsage(UUID familyId, UUID memberId, String feature, int inputTokens, int outputTokens, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.memberId = memberId;
        this.feature = feature;
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.createdAt = createdAt;
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

    public String getFeature() {
        return feature;
    }

    public int getInputTokens() {
        return inputTokens;
    }

    public int getOutputTokens() {
        return outputTokens;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
