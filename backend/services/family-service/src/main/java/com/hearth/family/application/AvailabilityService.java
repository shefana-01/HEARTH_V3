package com.hearth.family.application;

import com.hearth.family.domain.Availability;
import com.hearth.family.infrastructure.repository.AvailabilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AvailabilityService {

    private final AvailabilityRepository availabilityRepository;

    public List<Availability> getMemberAvailability(UUID memberId) {
        return availabilityRepository.findByMemberId(memberId);
    }

    @Transactional
    public Availability setAvailability(UUID memberId, Integer dayOfWeek, LocalTime start, LocalTime end, boolean isRecurring, LocalDate specificDate, boolean isAvailable) {
        Availability availability = Availability.builder()
                .memberId(memberId)
                .dayOfWeek(dayOfWeek)
                .startTime(start)
                .endTime(end)
                .isRecurring(isRecurring)
                .specificDate(specificDate)
                .isAvailable(isAvailable)
                .build();
        return availabilityRepository.save(availability);
    }
}
