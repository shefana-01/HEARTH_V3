package com.hearth.decision.domain;

import lombok.*;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriorityScore {
    private UUID taskId;
    private double totalScore; // P = w_D*D + w_C*C + w_I*I + w_R*R + w_S*S
    private double deadlineUrgency; // D
    private double careCriticality; // C
    private double dependencyImpact; // I
    private double reassignmentDifficulty; // R
    private double conflictSeverity; // S
    private String explanation;
}
