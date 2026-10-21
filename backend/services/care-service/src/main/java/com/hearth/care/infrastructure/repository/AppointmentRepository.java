package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.Appointment;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findByFamilyIdOrderByStartAtAsc(UUID familyId);

    Optional<Appointment> findByIdAndFamilyId(UUID id, UUID familyId);

    List<Appointment> findByFamilyIdAndEscortId(UUID familyId, UUID escortId);

    List<Appointment> findByFamilyIdAndForId(UUID familyId, UUID forId);

    /** Visits starting between now and {@code until} whose reminder has not gone out yet. */
    @Query("select a from Appointment a where a.reminderSentAt is null and a.startAt > :now and a.startAt <= :until")
    List<Appointment> findDueReminders(@Param("now") Instant now, @Param("until") Instant until);
}
