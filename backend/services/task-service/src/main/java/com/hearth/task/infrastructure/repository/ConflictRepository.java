package com.hearth.task.infrastructure.repository;

import com.hearth.task.domain.Conflict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConflictRepository extends JpaRepository<Conflict, UUID> {
    List<Conflict> findByTaskId(UUID taskId);
    List<Conflict> findByMemberIdAndResolvedFalse(UUID memberId);
}
