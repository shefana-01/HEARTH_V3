package com.hearth.care.medicine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** What a paramedic or a neighbour needs to know about a person in an emergency. */
@Entity
@Table(name = "emergency_info")
@IdClass(EmergencyInfo.Key.class)
public class EmergencyInfo {

    public record Key(UUID familyId, UUID personId) implements Serializable {
    }

    @Id
    @Column(name = "family_id")
    private UUID familyId;

    @Id
    @Column(name = "person_id")
    private UUID personId;

    @Column(name = "blood_group", nullable = false)
    private String bloodGroup = "";

    @Column(nullable = false)
    private String allergies = "";

    @Column(name = "doctor_name", nullable = false)
    private String doctorName = "";

    @Column(name = "doctor_phone", nullable = false)
    private String doctorPhone = "";

    @Column(nullable = false)
    private String hospital = "";

    @Column(nullable = false)
    private String notes = "";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    protected EmergencyInfo() {
    }

    public EmergencyInfo(UUID familyId, UUID personId) {
        this.familyId = familyId;
        this.personId = personId;
    }

    public void update(String bloodGroup, String allergies, String doctorName, String doctorPhone, String hospital, String notes, UUID by, Instant at) {
        this.bloodGroup = bloodGroup;
        this.allergies = allergies;
        this.doctorName = doctorName;
        this.doctorPhone = doctorPhone;
        this.hospital = hospital;
        this.notes = notes;
        this.updatedBy = by;
        this.updatedAt = at;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getPersonId() {
        return personId;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public String getAllergies() {
        return allergies;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public String getDoctorPhone() {
        return doctorPhone;
    }

    public String getHospital() {
        return hospital;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public UUID getUpdatedBy() {
        return updatedBy;
    }
}
