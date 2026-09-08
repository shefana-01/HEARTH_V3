package com.hearth.family.infrastructure.repository;

import com.hearth.family.domain.Availability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AvailabilityRepository extends JpaRepository<Availability, UUID> {
    List<Availability> findByMemberId(UUID memberId);
    List<Availability> findByMemberIdAndDayOfWeek(UUID memberId, Integer dayOfWeek);
    List<Availability> findByMemberIdAndSpecificDate(UUID memberId, LocalDate date);
}
