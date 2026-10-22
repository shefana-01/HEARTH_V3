package com.hearth.task.repository;

import com.hearth.task.domain.PersonalEvent;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonalEventRepository extends JpaRepository<PersonalEvent, UUID> {

    List<PersonalEvent> findByFamilyIdOrderByStartAtAsc(UUID familyId);

    List<PersonalEvent> findByFamilyIdAndMemberIdOrderByStartAtAsc(UUID familyId, UUID memberId);

    Optional<PersonalEvent> findByIdAndFamilyId(UUID id, UUID familyId);

    void deleteByFamilyIdAndMemberId(UUID familyId, UUID memberId);
}
