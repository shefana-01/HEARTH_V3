package com.hearth.care.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "grocery_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroceryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "nutrition_goal_id", nullable = false)
    private UUID nutritionGoalId;

    @Column(nullable = false)
    private String itemName;

    private String quantity;

    private Double estimatedCost;

    @Column(name = "converted_to_task_id")
    private UUID convertedToTaskId; // Linked to Task Service task (FR-18)
}
