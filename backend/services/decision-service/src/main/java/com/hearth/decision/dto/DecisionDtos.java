package com.hearth.decision.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.hearth.decision.engine.Model.CandidateScore;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.PriorityBreakdown;
import com.hearth.decision.engine.Model.Task;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match {@code decisionService.ts} and {@code domain.ts} in the frontend. */
public final class DecisionDtos {

    private DecisionDtos() {
    }

    /** A shared task that cannot go ahead as planned, with what to do about it. */
    public record AttentionItem(
            Conflict conflict,
            Task task,
            PriorityBreakdown priority,
            @JsonInclude(Include.NON_NULL) CandidateScore topCandidate,
            @JsonInclude(Include.NON_NULL) String openRequestId) {
    }

    public record TaskInsight(
            @JsonInclude(Include.NON_NULL) Conflict conflict,
            PriorityBreakdown priority,
            List<CandidateScore> candidates,
            @JsonInclude(Include.NON_NULL) String openRequestId) {
    }

    /** A task still being drafted: score everyone for it before it is saved. */
    public record PreviewRequest(String taskId, @NotBlank String category, @NotNull Instant start, int durationMin) {
    }

    public record RequestView(
            UUID id,
            UUID taskId,
            UUID fromMemberId,
            String reason,
            String note,
            Instant createdAt,
            UUID createdById,
            String status,
            @JsonInclude(Include.NON_NULL) UUID approvedMemberId,
            @JsonInclude(Include.NON_NULL) Instant resolvedAt) {
    }

    /** A request in the list, with the title and time of its task. */
    public record RequestListItem(@JsonUnwrapped RequestView request, String taskTitle, Instant taskStart) {
    }

    public record RequestDetail(
            RequestView request,
            Task task,
            List<CandidateScore> candidates,
            @JsonInclude(Include.NON_NULL) Conflict conflict) {
    }

    public record NewRequest(@NotNull UUID taskId, @NotBlank @Size(max = 200) String reason, @Size(max = 500) String note) {
    }

    public record ApproveRequest(@NotNull(message = "Choose who takes it over.") UUID memberId) {
    }

    /** One item in the week view: kind is task, completed, conflict, appointment, unavailable, event or busy. */
    public record ScheduleEvent(
            String id,
            String kind,
            String title,
            @JsonInclude(Include.NON_NULL) String subtitle,
            Instant start,
            Instant end,
            String memberId,
            @JsonInclude(Include.NON_NULL) String alsoMemberId,
            @JsonInclude(Include.NON_NULL) String href) {
    }
}
