package com.hearth.task.api;

import com.hearth.task.application.TaskService;
import com.hearth.task.domain.Task;
import com.hearth.task.dto.TaskDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;

    @GetMapping
    public List<Task> listTasks(@RequestHeader("X-Family-Id") UUID familyId,
                                @RequestHeader("X-Member-Id") UUID memberId) {
        return taskService.listVisibleTasks(familyId, memberId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Task> getTask(@PathVariable UUID id,
                                        @RequestHeader("X-Member-Id") UUID memberId) {
        try {
            return ResponseEntity.ok(taskService.getVisibleTask(id, memberId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
