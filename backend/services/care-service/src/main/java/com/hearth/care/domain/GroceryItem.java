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

/** One line on the family's shopping list: from a food suggestion (with a reason) or typed in. */
@Entity
@Table(name = "grocery_item")
public class GroceryItem {

    public static final String NEEDED = "needed";

    @Id
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String name;

    @Column(name = "food_group", nullable = false)
    private String group = "Other";

    @Column(nullable = false)
    private int quantity = 1;

    @Column(nullable = false)
    private String unit = "item";

    @Column(name = "estimated_price", nullable = false)
    private double estimatedPrice;

    @Column(nullable = false)
    private String status = NEEDED;

    @Column(name = "food_id")
    private String foodId;

    /** People it was added for: only people whose health notes may be named on the shared list. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "for_ids", nullable = false)
    private List<String> forIds = new ArrayList<>();

    private String reason;

    @Column(name = "added_by_id")
    private UUID addedById;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected GroceryItem() {
    }

    public GroceryItem(UUID familyId, UUID addedById) {
        this.id = UUID.randomUUID();
        this.familyId = familyId;
        this.addedById = addedById;
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

    public String getGroup() {
        return group;
    }

    public void setGroup(String group) {
        this.group = group;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = Math.max(1, quantity);
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public double getEstimatedPrice() {
        return estimatedPrice;
    }

    public void setEstimatedPrice(double estimatedPrice) {
        this.estimatedPrice = estimatedPrice;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getFoodId() {
        return foodId;
    }

    public void setFoodId(String foodId) {
        this.foodId = foodId;
    }

    public List<String> getForIds() {
        return forIds;
    }

    public void setForIds(List<String> forIds) {
        this.forIds = forIds;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public UUID getAddedById() {
        return addedById;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
