package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** The secret in a link we email: confirm the address, or set a new password. Only its hash is stored. */
@Entity
@Table(name = "one_time_token")
public class OneTimeToken {

    public static final String VERIFY_EMAIL = "verify-email";
    public static final String PASSWORD_RESET = "password-reset";

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(nullable = false)
    private String purpose;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected OneTimeToken() {
    }

    public OneTimeToken(UUID accountId, String purpose, String tokenHash, Instant expiresAt) {
        this.id = UUID.randomUUID();
        this.accountId = accountId;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public void use() {
        usedAt = Instant.now();
    }

    public UUID getAccountId() {
        return accountId;
    }

    public String getPurpose() {
        return purpose;
    }
}
