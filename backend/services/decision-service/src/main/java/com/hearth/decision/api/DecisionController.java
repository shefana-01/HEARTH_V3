package com.hearth.decision.api;

import com.hearth.decision.application.DecisionEngineService;
import com.hearth.decision.domain.PriorityScore;
import com.hearth.decision.dto.DecisionDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/decisions")
@RequiredArgsConstructor
public class DecisionController {

    private final DecisionEngineService decisionEngineService;

    @PostMapping("/priority")
    public ResponseEntity<PriorityScore> evaluateTaskPriority(@Valid @RequestBody PriorityEvaluationRequest request) {
        return ResponseEntity.ok(decisionEngineService.evaluateTaskPriority(request));
    }

    @PostMapping("/reassign")
    public ResponseEntity<ReassignmentRecommendationResponse> evaluateReassignment(
            @Valid @RequestBody ReassignmentEvaluationRequest request) {
        return ResponseEntity.ok(decisionEngineService.evaluateReassignmentCandidates(request));
    }
}
