package com.hearth.task.domain;

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

/**
 * Something on one person's own calendar: a class, a work shift, a gym session. Hearth treats it as time
 * that person is busy. {@code busy} visibility hides the title from the rest of the family.
 */
@Entity
@Table(name = "personal_event")
public class PersonalEvent {

    public static final String WEEKLY = "weekly";
    public static final String BUSY = "busy";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String kind;

    /** First (or only) occurrence; for weekly events also the time of day. */
    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(nullable = false)
    private String repeat;

    /** Monday to Sunday. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Boolean> days = new ArrayList<>();

    /** Weekly only: last day it happens (inclusive). Null = no end. */
    @Column(name = "until_at")
    private Instant untilAt;

    @Column(nullable = false)
    private String location = "";

    @Column(nullable = false)
    private String visibility;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PersonalEvent() {
    }

    public PersonalEvent(UUID familyId, UUID memberId) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.memberId = memberId;
        this.createdAt = Instant.now();
    }

    public boolean isWeekly() {
        return WEEKLY.equals(repeat);
    }

    public boolean isHidden() {
        return BUSY.equals(visibility);
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
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

    public String getRepeat() {
        return repeat;
    }

    public void setRepeat(String repeat) {
        this.repeat = repeat;
    }

    public List<Boolean> getDays() {
        return days;
    }

    public void setDays(List<Boolean> days) {
        this.days = days;
    }

    public Instant getUntilAt() {
        return untilAt;
    }

    public void setUntilAt(Instant untilAt) {
        this.untilAt = untilAt;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
