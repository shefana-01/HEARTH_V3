package com.hearth.care.medicine;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicationDoseRepository extends JpaRepository<MedicationDose, UUID> {

    List<MedicationDose> findByMedicationIdInAndScheduledAtBetween(Collection<UUID> medicationIds, Instant from, Instant to);

    Optional<MedicationDose> findByMedicationIdAndScheduledAt(UUID medicationId, Instant scheduledAt);
}
