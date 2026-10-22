package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** One family space. Everything else in Hearth belongs to exactly one family. */
@Entity
@Table(name = "family")
public class Family {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String location = "";

    /** IANA time zone, e.g. "Asia/Dhaka". Recurring events, "today" and availability windows use it. */
    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(name = "weekly_grocery_budget")
    private BigDecimal weeklyGroceryBudget;

    /** Code people enter to join, e.g. HEARTH-7K3QXD. */
    @Column(name = "invite_code", nullable = false)
    private String inviteCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Version
    private long version;

    protected Family() {
    }

    public Family(String name, String location, String timezone, String inviteCode) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.location = location;
        this.timezone = timezone;
        this.inviteCode = inviteCode;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getTimezone() {
        return timezone;
    }

    public BigDecimal getWeeklyGroceryBudget() {
        return weeklyGroceryBudget;
    }

    public void setWeeklyGroceryBudget(BigDecimal weeklyGroceryBudget) {
        this.weeklyGroceryBudget = weeklyGroceryBudget;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
