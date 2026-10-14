package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    List<Appointment> findByForId(UUID forId);

    List<Appointment> findByFamilyIdOrderByStartAtAsc(UUID familyId);
    Optional<Appointment> findByIdAndFamilyId(UUID id, UUID familyId);
    List<Appointment> findByFamilyIdAndEscortId(UUID familyId, UUID escortId);
    List<Appointment> findByFamilyIdAndForId(UUID familyId, UUID forId);
}
