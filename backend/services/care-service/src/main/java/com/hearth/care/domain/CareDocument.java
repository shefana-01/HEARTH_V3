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

/** The record of an uploaded file. The bytes live in file storage under {@code storageKey}. */
@Entity
@Table(name = "care_document")
public class CareDocument {

    public static final String FAMILY = "family";
    public static final String RESTRICTED = "restricted";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String category;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_kb", nullable = false)
    private int sizeKb;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    @Column(name = "uploaded_by_id", nullable = false)
    private UUID uploadedById;

    /** Who the document is about (a member or someone the family looks after); null = the household. */
    @Column(name = "owner_id")
    private UUID ownerId;

    /** {@code family} (members with document access) or {@code restricted} (only {@code allowedIds}). */
    @Column(nullable = false)
    private String access;

    /** Member ids (as text) allowed to open a restricted document. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "allowed_ids", nullable = false)
    private List<String> allowedIds = new ArrayList<>();

    @Column(name = "appointment_id")
    private UUID appointmentId;

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

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public int getSizeKb() {
        return sizeKb;
    }

    public void setSizeKb(int sizeKb) {
        this.sizeKb = sizeKb;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public void setStorageKey(String storageKey) {
        this.storageKey = storageKey;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(Instant uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public UUID getUploadedById() {
        return uploadedById;
    }

    public void setUploadedById(UUID uploadedById) {
        this.uploadedById = uploadedById;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public String getAccess() {
        return access;
    }

    public void setAccess(String access) {
        this.access = access;
    }

    public List<String> getAllowedIds() {
        return allowedIds;
    }

    public void setAllowedIds(List<String> allowedIds) {
        this.allowedIds = allowedIds;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(UUID appointmentId) {
        this.appointmentId = appointmentId;
    }
}
