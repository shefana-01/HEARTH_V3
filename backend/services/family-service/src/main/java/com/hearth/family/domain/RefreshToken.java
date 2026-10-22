package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A long-lived sign-in token. Only its SHA-256 hash is stored, so a copy of the database cannot be used to
 * sign in. Each token works once: using it revokes it and issues a new one ("rotation").
 */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected RefreshToken() {
    }

    public RefreshToken(UUID accountId, String tokenHash, Instant expiresAt) {
        this.id = UUID.randomUUID();
        this.accountId = accountId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    public boolean isUsable(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke() {
        if (revokedAt == null) {
            revokedAt = Instant.now();
        }
    }

    public UUID getAccountId() {
        return accountId;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
