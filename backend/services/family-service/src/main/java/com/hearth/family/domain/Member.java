package com.hearth.family.domain;

import com.hearth.common.family.Availability;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A person in a family who uses Hearth (or has been invited to).
 * {@code lead} organises the family space, {@code contributor} takes part, {@code observer} follows along.
 */
@Entity
@Table(name = "member")
public class Member {

    public static final String LEAD = "lead";
    public static final String CONTRIBUTOR = "contributor";
    public static final String OBSERVER = "observer";
    public static final String ACTIVE = "active";
    public static final String INVITED = "invited";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    /** Null until the invited person joins with their own account. */
    @Column(name = "account_id")
    private UUID accountId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String relation = "";

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String focus = "";

    private String phone;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> skills = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Availability availability;

    @Column(name = "access_schedule", nullable = false)
    private boolean accessSchedule = true;

    @Column(name = "access_medical", nullable = false)
    private boolean accessMedical;

    @Column(name = "access_documents", nullable = false)
    private boolean accessDocuments;

    @Column(name = "status_text")
    private String statusText;

    @Column(name = "status_until")
    private Instant statusUntil;

    @Column(name = "status_updated_at")
    private Instant statusUpdatedAt;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Version
    private long version;

    protected Member() {
    }

    public Member(UUID familyId, String name, String email, String relation, String role, String status, Availability availability) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.name = name;
        this.email = email;
        this.relation = relation;
        this.role = role;
        this.status = status;
        this.availability = availability;
        this.joinedAt = Instant.now();
    }

    public boolean isLead() {
        return LEAD.equals(role);
    }

    public boolean isActive() {
        return ACTIVE.equals(status);
    }

    /** The organiser sees everything; others see what their access allows. */
    public boolean canSeeMedical() {
        return isLead() || accessMedical;
    }

    public boolean canSeeDocuments() {
        return isLead() || accessDocuments;
    }

    /** The invited person joined with their account. */
    public void join(UUID accountId, String name) {
        this.accountId = accountId;
        this.name = name;
        this.status = ACTIVE;
        this.joinedAt = Instant.now();
    }

    public void setStatusNote(String text, Instant until) {
        this.statusText = text;
        this.statusUntil = until;
        this.statusUpdatedAt = text == null ? null : Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public void setAccountId(UUID accountId) {
        this.accountId = accountId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public String getFocus() {
        return focus;
    }

    public void setFocus(String focus) {
        this.focus = focus;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public List<String> getSkills() {
        return skills;
    }

    public void setSkills(List<String> skills) {
        this.skills = skills;
    }

    public Availability getAvailability() {
        return availability;
    }

    public void setAvailability(Availability availability) {
        this.availability = availability;
    }

    public boolean isAccessSchedule() {
        return accessSchedule;
    }

    public void setAccessSchedule(boolean accessSchedule) {
        this.accessSchedule = accessSchedule;
    }

    public boolean isAccessMedical() {
        return accessMedical;
    }

    public void setAccessMedical(boolean accessMedical) {
        this.accessMedical = accessMedical;
    }

    public boolean isAccessDocuments() {
        return accessDocuments;
    }

    public void setAccessDocuments(boolean accessDocuments) {
        this.accessDocuments = accessDocuments;
    }

    public String getStatusText() {
        return statusText;
    }

    public Instant getStatusUntil() {
        return statusUntil;
    }

    public Instant getStatusUpdatedAt() {
        return statusUpdatedAt;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
