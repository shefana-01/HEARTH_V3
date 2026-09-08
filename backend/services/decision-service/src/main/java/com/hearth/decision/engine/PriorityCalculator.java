package com.hearth.decision.engine;

import com.hearth.decision.domain.DecisionWeights;
import com.hearth.decision.domain.PriorityScore;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
public class PriorityCalculator {

    /**
     * Calculates task priority score:
     * P = w_D * D + w_C * C + w_I * I + w_R * R + w_S * S
     */
    public PriorityScore calculate(
            UUID taskId,
            Instant deadline,
            double careCriticality,
            int blockingDependencyCount,
            int eligibleCandidateCount,
            boolean hasActiveScheduleConflict,
            DecisionWeights weights) {

        // D: Deadline Urgency (0.0 to 1.0)
        long hoursToDeadline = Duration.between(Instant.now(), deadline).toHours();
        double d = hoursToDeadline <= 0 ? 1.0 : Math.max(0.0, 1.0 - (hoursToDeadline / 72.0));

        // C: Care Criticality (0.0 to 1.0)
        double c = Math.max(0.0, Math.min(1.0, careCriticality));

        // I: Dependency Impact (0.0 to 1.0)
        double i = Math.min(1.0, blockingDependencyCount * 0.25);

        // R: Reassignment Difficulty (how hard to replace) - fewer candidates = higher difficulty
        double r = eligibleCandidateCount <= 1 ? 1.0 : Math.max(0.1, 1.0 / eligibleCandidateCount);

        // S: Schedule Conflict Severity
        double s = hasActiveScheduleConflict ? 1.0 : 0.0;

        double total = (weights.getWeightDeadlineUrgency() * d)
                + (weights.getWeightCareCriticality() * c)
                + (weights.getWeightDependencyImpact() * i)
                + (weights.getWeightReassignmentDifficulty() * r)
                + (weights.getWeightConflictSeverity() * s);

        String explanation = buildExplanation(d, c, i, r, s, hoursToDeadline);

        return PriorityScore.builder()
                .taskId(taskId)
                .totalScore(Math.round(total * 100.0) / 100.0)
                .deadlineUrgency(Math.round(d * 100.0) / 100.0)
                .careCriticality(Math.round(c * 100.0) / 100.0)
                .dependencyImpact(Math.round(i * 100.0) / 100.0)
                .reassignmentDifficulty(Math.round(r * 100.0) / 100.0)
                .conflictSeverity(Math.round(s * 100.0) / 100.0)
                .explanation(explanation)
                .build();
    }

    private String buildExplanation(double d, double c, double i, double r, double s, long hoursToDeadline) {
        StringBuilder sb = new StringBuilder();
        if (d > 0.7) sb.append(String.format("Urgent deadline (%d hours remaining). ", Math.max(0, hoursToDeadline)));
        if (c >= 0.7) sb.append("High care criticality / dependent task. ");
        if (i > 0.5) sb.append("Blocks critical downstream household dependencies. ");
        if (s > 0) sb.append("Has active scheduling conflict requiring resolution. ");
        if (sb.length() == 0) sb.append("Standard priority routine task.");
        return sb.toString().trim();
    }
}
