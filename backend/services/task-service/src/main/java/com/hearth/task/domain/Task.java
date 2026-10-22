package com.hearth.task.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/**
 * Something to do at a time. A {@code family} task is shared: everyone sees it and it can be handed over.
 * A {@code private} task is a personal to-do: only its owner (and whoever wrote it down) sees the details,
 * and the rest of the family only sees that the time is taken.
 */
@Entity
@Table(name = "task")
public class Task {

    public static final String FAMILY = "family";
    public static final String PRIVATE = "private";
    public static final String SCHEDULED = "scheduled";
    public static final String COMPLETED = "completed";
    public static final String CANCELLED = "cancelled";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String notes = "";

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String priority;

    @Column(nullable = false)
    private String status = SCHEDULED;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @Column(name = "for_id")
    private UUID forId;

    @Column(nullable = false)
    private String visibility;

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "completed_by_id")
    private UUID completedById;

    @Column(nullable = false)
    private boolean reminder;

    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    @Column(name = "acknowledged_conflict")
    private String acknowledgedConflict;

    @Column(nullable = false)
    private String timezone = "UTC";

    @Version
    private long version;

    protected Task() {
    }

    public Task(UUID familyId, UUID createdById) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.createdById = createdById;
        this.createdAt = Instant.now();
    }

    public boolean isShared() {
        return FAMILY.equals(visibility);
    }

    public boolean isScheduled() {
        return SCHEDULED.equals(status);
    }

    /** A private task belongs to the person doing it and whoever wrote it down; a shared task is everyone's. */
    public boolean isVisibleTo(UUID memberId) {
        return isShared() || memberId.equals(assigneeId) || memberId.equals(createdById);
    }

    public Instant getEndAt() {
        return startAt.plusSeconds(durationMin * 60L);
    }

    public void complete(UUID memberId) {
        status = COMPLETED;
        completedAt = Instant.now();
        completedById = memberId;
    }

    public void reopen() {
        status = SCHEDULED;
        completedAt = null;
        completedById = null;
    }

    public void cancel() {
        status = CANCELLED;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public Instant getStartAt() {
        return startAt;
    }

    /** Moving a task means its reminder has not gone out for the new time yet. */
    public void setStartAt(Instant startAt) {
        if (this.startAt != null && !this.startAt.equals(startAt)) {
            this.reminderSentAt = null;
        }
        this.startAt = startAt;
    }

    public int getDurationMin() {
        return durationMin;
    }

    public void setDurationMin(int durationMin) {
        this.durationMin = durationMin;
    }

    public UUID getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(UUID assigneeId) {
        this.assigneeId = assigneeId;
    }

    public UUID getForId() {
        return forId;
    }

    public void setForId(UUID forId) {
        this.forId = forId;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public UUID getCreatedById() {
        return createdById;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(UUID appointmentId) {
        this.appointmentId = appointmentId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public UUID getCompletedById() {
        return completedById;
    }

    public boolean isReminder() {
        return reminder;
    }

    public void setReminder(boolean reminder) {
        this.reminder = reminder;
    }

    public Instant getReminderSentAt() {
        return reminderSentAt;
    }

    public void setReminderSentAt(Instant reminderSentAt) {
        this.reminderSentAt = reminderSentAt;
    }

    public String getAcknowledgedConflict() {
        return acknowledgedConflict;
    }

    public void setAcknowledgedConflict(String acknowledgedConflict) {
        this.acknowledgedConflict = acknowledgedConflict;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }
}
