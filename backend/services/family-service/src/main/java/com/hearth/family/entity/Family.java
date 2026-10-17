package com.hearth.family.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A family space: who belongs to it, where it is, and its shared settings. */
@Entity
@Table(name = "family")
public class Family {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String location = "";

    /** IANA time zone, e.g. "Asia/Dhaka". Availability windows and day boundaries use it. */
    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(name = "invite_code", nullable = false, unique = true)
    private String inviteCode;

    /** The most the family wants to spend on groceries in a week. Null = no budget set. */
    @Column(name = "weekly_grocery_budget")
    private Double weeklyGroceryBudget;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public Double getWeeklyGroceryBudget() {
        return weeklyGroceryBudget;
    }

    public void setWeeklyGroceryBudget(Double weeklyGroceryBudget) {
        this.weeklyGroceryBudget = weeklyGroceryBudget;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
