package com.hearth.task.infrastructure.repository;

import com.hearth.task.domain.Task;
import com.hearth.task.domain.TaskVisibility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findByFamilyId(UUID familyId);

    @Query("SELECT t FROM Task t WHERE t.familyId = :familyId AND (t.visibility = 'SHARED' OR t.assignedMemberId = :memberId)")
    List<Task> findVisibleTasks(@Param("familyId") UUID familyId, @Param("memberId") UUID memberId);

    @Query("SELECT t FROM Task t WHERE t.id = :id AND (t.visibility = 'SHARED' OR t.assignedMemberId = :memberId)")
    Optional<Task> findVisibleById(@Param("id") UUID id, @Param("memberId") UUID memberId);
}
