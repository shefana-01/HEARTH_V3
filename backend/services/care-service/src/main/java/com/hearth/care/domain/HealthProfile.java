package com.hearth.care.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One person's health notes: things a doctor told them (from a fixed list), their own goals, foods to
 * leave out and foods they like. A member owns theirs; the family keeps a dependant's. Not a medical
 * record: Hearth only uses it to suggest everyday foods.
 */
@Entity
@Table(name = "health_profile")
@IdClass(HealthProfile.Key.class)
public class HealthProfile {

    /** A goal in the person's own words, e.g. from a dietitian, with the kinds of food it points to. */
    public record Goal(String id, String title, String target, List<String> tags) {
    }

    /** The profile's id: one per person in a family. */
    public record Key(UUID familyId, UUID personId) implements Serializable {
    }

    @Id
    @Column(name = "family_id")
    private UUID familyId;

    @Id
    @Column(name = "person_id")
    private UUID personId;

    /** Ids from the conditions catalogue. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> conditions = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Goal> goals = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> avoid = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> preferences = new ArrayList<>();

    @Column(nullable = false)
    private String notes = "";

    /** Members only: family members with "medical" access may see it. A dependant's is always shared. */
    @Column(nullable = false)
    private boolean shared;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HealthProfile() {
    }

    public HealthProfile(UUID familyId, UUID personId) {
        this.familyId = familyId;
        this.personId = personId;
        this.updatedAt = Instant.now();
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getPersonId() {
        return personId;
    }

    public List<String> getConditions() {
        return conditions;
    }

    public void setConditions(List<String> conditions) {
        this.conditions = conditions;
    }

    public List<Goal> getGoals() {
        return goals;
    }

    public void setGoals(List<Goal> goals) {
        this.goals = goals;
    }

    public List<String> getAvoid() {
        return avoid;
    }

    public void setAvoid(List<String> avoid) {
        this.avoid = avoid;
    }

    public List<String> getPreferences() {
        return preferences;
    }

    public void setPreferences(List<String> preferences) {
        this.preferences = preferences;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public boolean isShared() {
        return shared;
    }

    public void setShared(boolean shared) {
        this.shared = shared;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
