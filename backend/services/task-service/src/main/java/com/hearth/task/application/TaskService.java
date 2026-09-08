package com.hearth.task.application;

import com.hearth.task.domain.*;
import com.hearth.task.dto.TaskDtos.*;
import com.hearth.task.infrastructure.repository.ConflictRepository;
import com.hearth.task.infrastructure.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ConflictRepository conflictRepository;

    @Transactional
    public TaskResponse createTask(CreateTaskRequest request, UUID creatorUserId) {
        Task task = Task.builder()
                .familyId(request.getFamilyId())
                .title(request.getTitle())
                .description(request.getDescription())
                .deadline(request.getDeadline())
                .estimatedDurationMinutes(request.getEstimatedDurationMinutes() != null ? request.getEstimatedDurationMinutes() : 30)
                .priority(request.getPriority() != null ? request.getPriority() : TaskPriority.MEDIUM)
                .careCriticality(request.getCareCriticality() != null ? request.getCareCriticality() : 0.5)
                .status(request.getAssignedMemberId() != null ? TaskStatus.ASSIGNED : TaskStatus.DRAFT)
                .assignedMemberId(request.getAssignedMemberId())
                .createdBy(creatorUserId)
                .build();

        Task saved = taskRepository.save(task);
        return mapToResponse(saved);
    }

    public List<TaskResponse> getFamilyTasks(UUID familyId) {
        return taskRepository.findByFamilyId(familyId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TaskResponse assignTask(UUID taskId, UUID memberId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        task.setAssignedMemberId(memberId);
        task.setStatus(TaskStatus.ACTIVE);
        return mapToResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse reportUnavailability(UUID taskId, UUID memberId, String reason) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        task.setStatus(TaskStatus.UNAVAILABLE);

        Conflict conflict = Conflict.builder()
                .taskId(taskId)
                .memberId(memberId)
                .conflictType("UNAVAILABILITY_REPORTED")
                .explanation("Member reported unavailability: " + (reason != null ? reason : "Cannot complete task."))
                .build();
        conflictRepository.save(conflict);

        return mapToResponse(taskRepository.save(task));
    }

    private TaskResponse mapToResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .familyId(task.getFamilyId())
                .title(task.getTitle())
                .description(task.getDescription())
                .deadline(task.getDeadline())
                .estimatedDurationMinutes(task.getEstimatedDurationMinutes())
                .priority(task.getPriority())
                .careCriticality(task.getCareCriticality())
                .status(task.getStatus())
                .assignedMemberId(task.getAssignedMemberId())
                .createdBy(task.getCreatedBy())
                .createdAt(task.getCreatedAt())
                .build();
    }
}
