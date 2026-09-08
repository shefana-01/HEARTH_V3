package com.hearth.task.dto;

import com.hearth.task.domain.TaskPriority;
import com.hearth.task.domain.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

public class TaskDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateTaskRequest {
        @NotNull
        private UUID familyId;
        @NotBlank
        private String title;
        private String description;
        @NotNull
        private Instant deadline;
        private Integer estimatedDurationMinutes;
        private TaskPriority priority;
        private Double careCriticality;
        private UUID assignedMemberId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssignTaskRequest {
        @NotNull
        private UUID memberId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReportUnavailabilityRequest {
        private String reason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TaskResponse {
        private UUID id;
        private UUID familyId;
        private String title;
        private String description;
        private Instant deadline;
        private Integer estimatedDurationMinutes;
        private TaskPriority priority;
        private Double careCriticality;
        private TaskStatus status;
        private UUID assignedMemberId;
        private UUID createdBy;
        private Instant createdAt;
    }
}
