package com.hearth.care.medicine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicationRepository extends JpaRepository<Medication, UUID> {

    List<Medication> findByFamilyIdOrderByCreatedAtAsc(UUID familyId);

    Optional<Medication> findByIdAndFamilyId(UUID id, UUID familyId);

    List<Medication> findByActiveTrueAndRemindersTrue();

    List<Medication> findByFamilyIdAndPersonId(UUID familyId, UUID personId);

    List<Medication> findByFamilyIdAndCarerId(UUID familyId, UUID carerId);
}
