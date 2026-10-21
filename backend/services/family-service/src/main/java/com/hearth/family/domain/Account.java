package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/** Someone who can sign in. Joins at most one family (through a {@link Member}). */
@Entity
@Table(name = "account")
public class Account {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    private String phone;

    @Column(nullable = false)
    private String about = "";

    /** A small profile picture as a data URL. */
    private String photo;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "whatsapp_alerts", nullable = false)
    private boolean whatsappAlerts;

    @Column(name = "failed_sign_ins", nullable = false)
    private int failedSignIns;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Version
    private long version;

    protected Account() {
    }

    public Account(String email, String passwordHash, String name) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.createdAt = Instant.now();
    }

    /** True while sign-in is paused after too many wrong passwords. */
    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    /** Counts a wrong password; after {@code limit} in a row, sign-in is paused until {@code until}. */
    public void recordFailedSignIn(int limit, Instant until) {
        failedSignIns++;
        if (failedSignIns >= limit) {
            lockedUntil = until;
            failedSignIns = 0;
        }
    }

    public void recordSuccessfulSignIn() {
        failedSignIns = 0;
        lockedUntil = null;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public String getPhoto() {
        return photo;
    }

    public void setPhoto(String photo) {
        this.photo = photo;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public boolean isWhatsappAlerts() {
        return whatsappAlerts;
    }

    public void setWhatsappAlerts(boolean whatsappAlerts) {
        this.whatsappAlerts = whatsappAlerts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
