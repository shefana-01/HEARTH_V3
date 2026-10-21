package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.HealthProfile;
import com.hearth.care.domain.HealthProfile.Key;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HealthProfileRepository extends JpaRepository<HealthProfile, Key> {

    List<HealthProfile> findByFamilyId(UUID familyId);

    Optional<HealthProfile> findByFamilyIdAndPersonId(UUID familyId, UUID personId);

    @Modifying
    @Query("delete from HealthProfile h where h.familyId = :familyId and h.personId = :personId")
    void deletePerson(@Param("familyId") UUID familyId, @Param("personId") UUID personId);
}
