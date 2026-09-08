package com.hearth.task.api;

import com.hearth.task.application.TaskService;
import com.hearth.task.dto.TaskDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(
            @Valid @RequestBody CreateTaskRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "00000000-0000-0000-0000-000000000001") UUID userId) {
        return ResponseEntity.ok(taskService.createTask(request, userId));
    }

    @GetMapping("/family/{familyId}")
    public ResponseEntity<List<TaskResponse>> getFamilyTasks(@PathVariable UUID familyId) {
        return ResponseEntity.ok(taskService.getFamilyTasks(familyId));
    }

    @PostMapping("/{taskId}/assign")
    public ResponseEntity<TaskResponse> assignTask(
            @PathVariable UUID taskId,
            @Valid @RequestBody AssignTaskRequest request) {
        return ResponseEntity.ok(taskService.assignTask(taskId, request.getMemberId()));
    }

    @PostMapping("/{taskId}/unavailability")
    public ResponseEntity<TaskResponse> reportUnavailability(
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Member-Id", defaultValue = "00000000-0000-0000-0000-000000000001") UUID memberId,
            @RequestBody(required = false) ReportUnavailabilityRequest request) {
        String reason = request != null ? request.getReason() : "Member reported unavailable";
        return ResponseEntity.ok(taskService.reportUnavailability(taskId, memberId, reason));
    }
}
