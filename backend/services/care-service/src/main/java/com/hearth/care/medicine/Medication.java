package com.hearth.care.medicine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A medicine someone takes on a schedule: at these local times, on these days, from start to end. */
@Entity
@Table(name = "medication")
public class Medication {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String dose = "";

    @Column(nullable = false)
    private String instructions = "";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> times = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Boolean> days = new ArrayList<>();

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "carer_id")
    private UUID carerId;

    @Column(nullable = false)
    private boolean reminders = true;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private String timezone;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Medication() {
    }

    public Medication(UUID familyId, UUID personId, UUID createdBy, Instant now) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.personId = personId;
        this.createdBy = createdBy;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Whether the member (or the person themselves) is involved in this medicine. */
    public boolean involves(UUID memberId) {
        return memberId.equals(personId) || memberId.equals(carerId);
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getPersonId() {
        return personId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDose() {
        return dose;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public List<String> getTimes() {
        return times;
    }

    public void setTimes(List<String> times) {
        this.times = new ArrayList<>(times);
    }

    public List<Boolean> getDays() {
        return days;
    }

    public void setDays(List<Boolean> days) {
        this.days = new ArrayList<>(days);
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public UUID getCarerId() {
        return carerId;
    }

    public void setCarerId(UUID carerId) {
        this.carerId = carerId;
    }

    public boolean isReminders() {
        return reminders;
    }

    public void setReminders(boolean reminders) {
        this.reminders = reminders;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void touch(Instant now) {
        this.updatedAt = now;
    }

    public long getVersion() {
        return version;
    }
}
