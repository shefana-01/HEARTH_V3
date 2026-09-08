package com.hearth.decision.application;

import com.hearth.decision.domain.*;
import com.hearth.decision.dto.DecisionDtos.*;
import com.hearth.decision.engine.PriorityCalculator;
import com.hearth.decision.engine.SuitabilityCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DecisionEngineService {

    private final PriorityCalculator priorityCalculator;
    private final SuitabilityCalculator suitabilityCalculator;

    private final DecisionWeights defaultWeights = new DecisionWeights();

    public PriorityScore evaluateTaskPriority(PriorityEvaluationRequest request) {
        return priorityCalculator.calculate(
                request.getTaskId(),
                request.getDeadline(),
                request.getCareCriticality(),
                request.getBlockingDependencyCount(),
                request.getEligibleCandidateCount(),
                request.isHasActiveScheduleConflict(),
                defaultWeights
        );
    }

    public ReassignmentRecommendationResponse evaluateReassignmentCandidates(ReassignmentEvaluationRequest request) {
        List<SuitabilityScore> scoredCandidates = request.getCandidates().stream()
                .map(c -> suitabilityCalculator.calculate(
                        c.getMemberId(),
                        c.getMemberName(),
                        c.getAvailabilityRatio(),
                        c.getCurrentAssignedTasksCount(),
                        c.getMaxDailyWorkload() > 0 ? c.getMaxDailyWorkload() : 5,
                        c.isHasRequiredSkill(),
                        c.getConflictCostPenalty(),
                        defaultWeights
                ))
                .sorted(Comparator.comparingDouble(SuitabilityScore::getTotalScore).reversed())
                .collect(Collectors.toList());

        SuitabilityScore topCandidate = scoredCandidates.isEmpty() ? null : scoredCandidates.get(0);

        String summary = topCandidate != null
                ? String.format("Recommended %s (Score: %.2f) — %s",
                topCandidate.getCandidateName(), topCandidate.getTotalScore(), topCandidate.getExplanation())
                : "No eligible candidates available. Flagging for Administrator attention.";

        return ReassignmentRecommendationResponse.builder()
                .taskId(request.getTaskId())
                .taskTitle(request.getTaskTitle())
                .rankedCandidates(scoredCandidates)
                .topCandidateId(topCandidate != null ? topCandidate.getCandidateMemberId() : null)
                .recommendationSummary(summary)
                .build();
    }
}
