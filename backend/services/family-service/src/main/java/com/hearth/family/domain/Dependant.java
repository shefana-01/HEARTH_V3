package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Someone the family looks after who does not use Hearth themselves: a child, an elderly parent, a
 * relative who is unwell. Tasks, appointments, documents and health notes can be about them.
 */
@Entity
@Table(name = "dependant")
public class Dependant {

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String relation = "";

    @Column(name = "birth_year")
    private Integer birthYear;

    @Column(nullable = false)
    private String notes = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Dependant() {
    }

    public Dependant(UUID familyId) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }

    public Integer getBirthYear() {
        return birthYear;
    }

    public void setBirthYear(Integer birthYear) {
        this.birthYear = birthYear;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
