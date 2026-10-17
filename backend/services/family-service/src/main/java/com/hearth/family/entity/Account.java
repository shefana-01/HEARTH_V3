package com.hearth.family.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A person who can sign in. Passwords are not stored here; the identity provider owns them. */
@Entity
@Table(name = "account")
public class Account {

    @Id
    private UUID id;

    /** The identity provider's id for this person (the JWT "sub" claim). */
    @Column(nullable = false, unique = true)
    private String subject;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String name;

    private String phone;

    @Column(nullable = false)
    private String about = "";

    /** Small profile picture as a data URL. */
    private String photo;

    @Column(name = "whatsapp_alerts", nullable = false)
    private boolean whatsappAlerts;

    /** True once the person has opened the link we emailed to this address. */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
