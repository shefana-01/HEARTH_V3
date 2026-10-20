package com.hearth.task.api;

import com.hearth.task.application.PlanningService;
import com.hearth.task.application.TaskService;
import com.hearth.task.dto.TaskDtos.AcknowledgeRequest;
import com.hearth.task.dto.TaskDtos.PlanChange;
import com.hearth.task.dto.TaskDtos.PlanningData;
import com.hearth.task.dto.TaskDtos.TaskView;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * For decision-service only. The gateway does not route {@code /internal}, and the caller's token is still
 * required, so every answer and change concerns the caller's own family and what they may see.
 */
@RestController
@RequestMapping("/api/v1/internal")
public class InternalTaskController {

    private final PlanningService planning;
    private final TaskService tasks;

    public InternalTaskController(PlanningService planning, TaskService tasks) {
        this.planning = planning;
        this.tasks = tasks;
    }

    @GetMapping("/planning")
    public PlanningData planning() {
        return planning.planning();
    }

    @PutMapping("/tasks/{id}/plan")
    public TaskView applyPlan(@PathVariable UUID id, @RequestBody PlanChange change) {
        return tasks.applyPlan(id, change);
    }

    @PostMapping("/tasks/{id}/acknowledge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acknowledge(@PathVariable UUID id, @Valid @RequestBody AcknowledgeRequest request) {
        tasks.acknowledge(id, request.kind());
    }
}
