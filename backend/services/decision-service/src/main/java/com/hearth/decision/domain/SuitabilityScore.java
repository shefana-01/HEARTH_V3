package com.hearth.decision.domain;

import lombok.*;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuitabilityScore {
    private UUID candidateMemberId;
    private String candidateName;
    private double totalScore; // Score = w1*Availability + w2*Workload + w3*Skill - w4*ConflictCost
    private double availabilityScore;
    private double workloadCapacityScore;
    private double skillEligibilityScore;
    private double conflictCost;
    private String explanation;
}
