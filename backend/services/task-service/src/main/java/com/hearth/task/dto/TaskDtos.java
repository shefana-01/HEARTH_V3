package com.hearth.task.dto;

import com.hearth.task.domain.TaskPriority;
import com.hearth.task.domain.TaskStatus;
import com.hearth.task.domain.TaskVisibility;
import java.time.Instant;
import java.util.UUID;

public class TaskDtos {
    public record CreateTaskRequest(
            String title,
            String description,
            Instant deadline,
            Integer estimatedDurationMinutes,
            TaskPriority priority,
            Double careCriticality,
            TaskVisibility visibility,
            UUID assignedMemberId
    ) {}

    public record TaskResponse(
            UUID id,
            UUID familyId,
            String title,
            String description,
            Instant deadline,
            Integer estimatedDurationMinutes,
            TaskPriority priority,
            Double careCriticality,
            TaskStatus status,
            TaskVisibility visibility,
            UUID assignedMemberId,
            UUID createdBy,
            Instant createdAt
    ) {}
}
