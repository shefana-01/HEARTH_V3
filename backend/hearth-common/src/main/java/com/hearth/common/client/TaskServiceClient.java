package com.hearth.common.client;

import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * HEAR-468: Declarative client contract for task-service.
 * Queries family tasks, deadlines, and member unavailabilities.
 */
public interface TaskServiceClient {

    @GetMapping("/api/v1/tasks/internal/plan")
    List<?> getTasksForPlan(
            @RequestParam("familyId") UUID familyId,
            @RequestParam("from") String from,
            @RequestParam("to") String to);
}
