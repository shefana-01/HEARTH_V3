package com.hearth.family.api;

import com.hearth.family.application.AvailabilityService;
import com.hearth.family.domain.Availability;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    @GetMapping("/member/{memberId}")
    public ResponseEntity<List<Availability>> getMemberAvailability(@PathVariable UUID memberId) {
        return ResponseEntity.ok(availabilityService.getMemberAvailability(memberId));
    }

    @PostMapping("/member/{memberId}")
    public ResponseEntity<Availability> setAvailability(
            @PathVariable UUID memberId,
            @RequestParam(required = false) Integer dayOfWeek,
            @RequestParam String startTime,
            @RequestParam String endTime,
            @RequestParam(defaultValue = "true") boolean isRecurring,
            @RequestParam(required = false) String specificDate,
            @RequestParam(defaultValue = "true") boolean isAvailable) {

        LocalTime start = LocalTime.parse(startTime);
        LocalTime end = LocalTime.parse(endTime);
        LocalDate date = specificDate != null ? LocalDate.parse(specificDate) : null;

        return ResponseEntity.ok(availabilityService.setAvailability(
                memberId, dayOfWeek, start, end, isRecurring, date, isAvailable));
    }
}
