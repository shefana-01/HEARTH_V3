package com.hearth.decision.engine;

import com.hearth.decision.domain.DecisionWeights;
import com.hearth.decision.domain.SuitabilityScore;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class SuitabilityCalculator {

    /**
     * Calculates Candidate Suitability Score:
     * Score(m, t) = w1 * Availability + w2 * WorkloadCapacity + w3 * SkillEligibility - w4 * ConflictCost
     */
    public SuitabilityScore calculate(
            UUID memberId,
            String memberName,
            double availabilityRatio,       // 0.0 to 1.0 (free slot match)
            int currentAssignedTasksCount,  // workload
            int maxDailyWorkload,           // e.g. 5
            boolean hasRequiredSkill,       // e.g. certified caregiver or driver
            double conflictCostPenalty,     // 0.0 to 1.0
            DecisionWeights weights) {

        // 1. Availability (0.0 to 1.0)
        double a = Math.max(0.0, Math.min(1.0, availabilityRatio));

        // 2. WorkloadCapacity (1.0 = completely free, 0.0 = maxed out)
        double workload = Math.max(0.0, 1.0 - ((double) currentAssignedTasksCount / Math.max(1, maxDailyWorkload)));

        // 3. SkillEligibility (1.0 or 0.0)
        double skill = hasRequiredSkill ? 1.0 : 0.0;

        // 4. ConflictCost (0.0 to 1.0)
        double conflict = Math.max(0.0, Math.min(1.0, conflictCostPenalty));

        // Deterministic formula
        double rawScore = (weights.getWeightAvailability() * a)
                + (weights.getWeightWorkloadCapacity() * workload)
                + (weights.getWeightSkillEligibility() * skill)
                - (weights.getWeightConflictCost() * conflict);

        double total = Math.max(0.0, Math.min(1.0, rawScore));

        String explanation = buildExplanation(memberName, a, workload, hasRequiredSkill, conflict);

        return SuitabilityScore.builder()
                .candidateMemberId(memberId)
                .candidateName(memberName)
                .totalScore(Math.round(total * 100.0) / 100.0)
                .availabilityScore(Math.round(a * 100.0) / 100.0)
                .workloadCapacityScore(Math.round(workload * 100.0) / 100.0)
                .skillEligibilityScore(Math.round(skill * 100.0) / 100.0)
                .conflictCost(Math.round(conflict * 100.0) / 100.0)
                .explanation(explanation)
                .build();
    }

    private String buildExplanation(String name, double a, double workload, boolean skill, double conflict) {
        StringBuilder sb = new StringBuilder();
        if (skill) sb.append("Eligible for task role. ");
        else sb.append("Lacks specific role certification. ");

        if (a >= 0.8) sb.append(name).append(" has a clear schedule window. ");
        else if (a > 0.4) sb.append(name).append(" has partial schedule overlap. ");
        else sb.append(name).append(" is currently unavailable during deadline. ");

        if (workload >= 0.7) sb.append("Low current workload. ");
        else if (workload <= 0.3) sb.append("High current workload. ");

        if (conflict > 0) sb.append("Warning: Introduces minor downstream schedule shift.");

        return sb.toString().trim();
    }
}
