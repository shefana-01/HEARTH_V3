package com.hearth.task.infrastructure.repository;

import com.hearth.task.domain.PersonalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PersonalEventRepository extends JpaRepository<PersonalEvent, UUID> {
    List<PersonalEvent> findByMemberIdAndStartTimeBetween(UUID memberId, Instant start, Instant end);
}
