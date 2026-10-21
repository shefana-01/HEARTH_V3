package com.hearth.task.repository;

import com.hearth.task.domain.Unavailability;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnavailabilityRepository extends JpaRepository<Unavailability, UUID> {

    List<Unavailability> findByFamilyIdOrderByStartAtAsc(UUID familyId);

    List<Unavailability> findByFamilyIdAndMemberIdOrderByStartAtAsc(UUID familyId, UUID memberId);

    Optional<Unavailability> findByIdAndFamilyId(UUID id, UUID familyId);

    void deleteByFamilyIdAndMemberId(UUID familyId, UUID memberId);
}
