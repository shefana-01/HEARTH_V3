package com.hearth.care.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A visit or check-in for one person (a member or someone the family looks after), with who goes along and what to prepare. */
@Entity
@Table(name = "appointment")
public class Appointment {

    /** The preparation checklist, stored as one JSON document with the appointment. */
    public record Prep(List<PrepItem> items) {

        public static Prep empty() {
            return new Prep(new ArrayList<>());
        }

        public List<PrepItem> itemsOrEmpty() {
            return items == null ? List.of() : items;
        }
    }

    public record PrepItem(String id, String label, boolean done, String doneById) {
    }

    public static final String FAMILY = "family";
    public static final String PRIVATE = "private";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String specialty = "";

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(nullable = false)
    private String provider = "";

    @Column(nullable = false)
    private String location = "";

    @Column(name = "for_id", nullable = false)
    private UUID forId;

    @Column(name = "escort_id")
    private UUID escortId;

    /** {@code family} (everyone sees it) or {@code private} (only the people involved). */
    @Column(nullable = false)
    private String visibility;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Prep prep = Prep.empty();

    @Column(nullable = false)
    private String note = "";

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** When the "starts within the hour" reminder was raised; null until then, and again after the visit is moved. */
    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    /** The family's time zone when the visit was last saved, used to word the reminder. */
    @Column(nullable = false)
    private String timezone = "UTC";

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public void setFamilyId(UUID familyId) {
        this.familyId = familyId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSpecialty() {
        return specialty;
    }

    public void setSpecialty(String specialty) {
        this.specialty = specialty;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public void setStartAt(Instant startAt) {
        this.startAt = startAt;
    }

    public int getDurationMin() {
        return durationMin;
    }

    public void setDurationMin(int durationMin) {
        this.durationMin = durationMin;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public UUID getForId() {
        return forId;
    }

    public void setForId(UUID forId) {
        this.forId = forId;
    }

    public UUID getEscortId() {
        return escortId;
    }

    public void setEscortId(UUID escortId) {
        this.escortId = escortId;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public boolean isShared() {
        return FAMILY.equals(visibility);
    }

    public Prep getPrep() {
        return prep;
    }

    public void setPrep(Prep prep) {
        this.prep = prep;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public UUID getCreatedById() {
        return createdById;
    }

    public void setCreatedById(UUID createdById) {
        this.createdById = createdById;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getReminderSentAt() {
        return reminderSentAt;
    }

    public void setReminderSentAt(Instant reminderSentAt) {
        this.reminderSentAt = reminderSentAt;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }
}
