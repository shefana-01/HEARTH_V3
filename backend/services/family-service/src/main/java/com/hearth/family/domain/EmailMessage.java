package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * An email waiting to be sent. It is saved in the same transaction as the change that needs it (sign-up,
 * invitation, password reset) and sent afterwards by {@code EmailRelay}, so a slow or unavailable mail
 * server never fails or slows down the request.
 */
@Entity
@Table(name = "email_outbox")
public class EmailMessage {

    @Id
    private UUID id;

    @Column(name = "to_address", nullable = false)
    private String to;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "last_error")
    private String lastError;

    protected EmailMessage() {
    }

    public EmailMessage(String to, String subject, String body) {
        this.id = UUID.randomUUID();
        this.to = to;
        this.subject = subject;
        this.body = body;
        this.createdAt = Instant.now();
    }

    public void markSent() {
        this.sentAt = Instant.now();
        this.attempts++;
        this.lastError = null;
    }

    public void markFailed(String error) {
        this.attempts++;
        this.lastError = error == null ? "unknown" : error.substring(0, Math.min(500, error.length()));
    }

    public String getTo() {
        return to;
    }

    public String getSubject() {
        return subject;
    }

    public String getBody() {
        return body;
    }

    public int getAttempts() {
        return attempts;
    }
}
