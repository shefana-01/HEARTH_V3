package com.hearth.notification.push;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One browser or phone that asked to receive Hearth notifications for a member. */
@Entity
@Table(name = "push_subscription")
public class PushSubscription {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(nullable = false, unique = true)
    private String endpoint;

    @Column(nullable = false)
    private String p256dh;

    @Column(nullable = false)
    private String auth;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    protected PushSubscription() {
    }

    public PushSubscription(UUID familyId, UUID memberId, String endpoint, String p256dh, String auth, String userAgent, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.memberId = memberId;
        this.endpoint = endpoint;
        this.p256dh = p256dh;
        this.auth = auth;
        this.userAgent = userAgent;
        this.createdAt = createdAt;
    }

    /** The same browser subscribed again (for example after signing in as someone else). */
    public void reassign(UUID familyId, UUID memberId, String p256dh, String auth, String userAgent) {
        this.familyId = familyId;
        this.memberId = memberId;
        this.p256dh = p256dh;
        this.auth = auth;
        this.userAgent = userAgent;
    }

    public void used(Instant at) {
        this.lastUsedAt = at;
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

    public String getEndpoint() {
        return endpoint;
    }

    public String getP256dh() {
        return p256dh;
    }

    public String getAuth() {
        return auth;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }
}
