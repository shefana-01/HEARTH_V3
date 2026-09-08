package com.hearth.decision.dto;

import com.hearth.decision.domain.PriorityScore;
import com.hearth.decision.domain.SuitabilityScore;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class DecisionDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PriorityEvaluationRequest {
        private UUID taskId;
        private Instant deadline;
        private double careCriticality;
        private int blockingDependencyCount;
        private int eligibleCandidateCount;
        private boolean hasActiveScheduleConflict;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CandidateEvaluationItem {
        private UUID memberId;
        private String memberName;
        private double availabilityRatio;
        private int currentAssignedTasksCount;
        private int maxDailyWorkload;
        private boolean hasRequiredSkill;
        private double conflictCostPenalty;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReassignmentEvaluationRequest {
        private UUID taskId;
        private String taskTitle;
        private List<CandidateEvaluationItem> candidates;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReassignmentRecommendationResponse {
        private UUID taskId;
        private String taskTitle;
        private List<SuitabilityScore> rankedCandidates;
        private UUID topCandidateId;
        private String recommendationSummary;
    }
}
