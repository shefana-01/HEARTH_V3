package com.hearth.care.medicine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** What happened to one scheduled dose: taken, skipped on purpose, or missed (nobody marked it). */
@Entity
@Table(name = "medication_dose")
public class MedicationDose {

    public static final String TAKEN = "taken";
    public static final String SKIPPED = "skipped";
    public static final String MISSED = "missed";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "medication_id", nullable = false)
    private UUID medicationId;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Column(nullable = false)
    private String status;

    @Column(name = "recorded_by")
    private UUID recordedBy;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected MedicationDose() {
    }

    public MedicationDose(UUID familyId, UUID medicationId, Instant scheduledAt) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.medicationId = medicationId;
        this.scheduledAt = scheduledAt;
    }

    public void record(String status, UUID by, Instant at) {
        this.status = status;
        this.recordedBy = by;
        this.recordedAt = at;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getMedicationId() {
        return medicationId;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public String getStatus() {
        return status;
    }

    public UUID getRecordedBy() {
        return recordedBy;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }
}
