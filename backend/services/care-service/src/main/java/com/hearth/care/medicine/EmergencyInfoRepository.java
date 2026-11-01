package com.hearth.care.medicine;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmergencyInfoRepository extends JpaRepository<EmergencyInfo, EmergencyInfo.Key> {

    Optional<EmergencyInfo> findByFamilyIdAndPersonId(UUID familyId, UUID personId);

    void deleteByFamilyIdAndPersonId(UUID familyId, UUID personId);
}
