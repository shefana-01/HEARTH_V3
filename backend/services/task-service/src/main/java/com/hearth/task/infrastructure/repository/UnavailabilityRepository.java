package com.hearth.task.infrastructure.repository;

import com.hearth.task.domain.Unavailability;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface UnavailabilityRepository extends JpaRepository<Unavailability, UUID> {
    List<Unavailability> findByMemberIdAndEndTimeAfterAndStartTimeBefore(UUID memberId, Instant start, Instant end);
}
