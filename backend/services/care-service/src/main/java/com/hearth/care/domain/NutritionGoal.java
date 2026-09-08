package com.hearth.care.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "nutrition_goals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NutritionGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(nullable = false)
    private String goalCategory; // e.g. "Low Sodium", "High Protein", "Diabetic Friendly"

    private Double budgetLimit;

    @Column(columnDefinition = "TEXT")
    private String dietaryPreferences;
}
