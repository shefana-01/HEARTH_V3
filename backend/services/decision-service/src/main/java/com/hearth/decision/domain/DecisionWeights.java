package com.hearth.decision.domain;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DecisionWeights {

    // Task Priority Formula Weights: P = w_D*D + w_C*C + w_I*I + w_R*R + w_S*S
    @Builder.Default
    private double weightDeadlineUrgency = 0.25;

    @Builder.Default
    private double weightCareCriticality = 0.30;

    @Builder.Default
    private double weightDependencyImpact = 0.20;

    @Builder.Default
    private double weightReassignmentDifficulty = 0.10;

    @Builder.Default
    private double weightConflictSeverity = 0.15;

    // Candidate Suitability Formula Weights: Score = w1*Availability + w2*Workload + w3*Skill - w4*ConflictCost
    @Builder.Default
    private double weightAvailability = 0.35;

    @Builder.Default
    private double weightWorkloadCapacity = 0.25;

    @Builder.Default
    private double weightSkillEligibility = 0.25;

    @Builder.Default
    private double weightConflictCost = 0.15;
}
