package com.hearth.task.infrastructure.repository;

import com.hearth.task.domain.Task;
import com.hearth.task.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findByFamilyId(UUID familyId);
    List<Task> findByAssignedMemberId(UUID memberId);
    List<Task> findByFamilyIdAndStatus(UUID familyId, TaskStatus status);
}
