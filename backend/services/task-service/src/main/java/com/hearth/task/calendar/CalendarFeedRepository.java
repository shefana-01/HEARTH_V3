package com.hearth.task.calendar;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarFeedRepository extends JpaRepository<CalendarFeed, UUID> {

    Optional<CalendarFeed> findByTokenHash(String tokenHash);
}
