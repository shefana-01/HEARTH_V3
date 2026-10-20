package com.hearth.decision.repository;

import com.hearth.decision.domain.ReassignmentRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReassignmentRequestRepository extends JpaRepository<ReassignmentRequest, UUID> {

    List<ReassignmentRequest> findByFamilyIdOrderByCreatedAtDesc(UUID familyId);

    Optional<ReassignmentRequest> findByIdAndFamilyId(UUID id, UUID familyId);

    Optional<ReassignmentRequest> findByFamilyIdAndTaskIdAndStatus(UUID familyId, UUID taskId, String status);

    List<ReassignmentRequest> findByFamilyIdAndStatus(UUID familyId, String status);
}
