package com.hearth.task.application;

import com.hearth.task.domain.*;
import com.hearth.task.dto.TaskDtos;
import com.hearth.task.infrastructure.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskService {
    private final TaskRepository taskRepository;
    private final OutboxWriter outboxWriter;

    public List<Task> listVisibleTasks(UUID familyId, UUID memberId) {
        return taskRepository.findVisibleTasks(familyId, memberId);
    }

    public Task getVisibleTask(UUID taskId, UUID memberId) {
        return taskRepository.findVisibleById(taskId, memberId)
                .orElseThrow(() -> new RuntimeException("Task not found or access denied"));
    }

    @Transactional
    public Task createTask(Task task) {
        Task saved = taskRepository.save(task);
        outboxWriter.writeEvent("TASK", saved.getId(), "TASK_CREATED", "{}");
        return saved;
    }
}
