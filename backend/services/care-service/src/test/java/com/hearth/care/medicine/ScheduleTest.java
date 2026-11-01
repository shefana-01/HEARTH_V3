package com.hearth.care.medicine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ScheduleTest {

    private static final ZoneId DHAKA = ZoneId.of("Asia/Dhaka");

    private static Medication medication(List<String> times, List<Boolean> days, LocalDate start, LocalDate end) {
        Medication m = new Medication(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), Instant.now());
        m.setTimes(times);
        m.setDays(days);
        m.setStartDate(start);
        m.setEndDate(end);
        m.setTimezone("Asia/Dhaka");
        return m;
    }

    private static Instant at(int day, int hour, int minute) {
        return ZonedDateTime.of(2026, 11, day, hour, minute, 0, 0, DHAKA).toInstant();
    }

    @Test
    @DisplayName("every chosen day, at each local time, in order")
    void slotsAtLocalTimes() {
        Medication m = medication(List.of("20:00", "08:00"), List.of(true, true, true, true, true, true, true), LocalDate.of(2026, 11, 1), null);
        List<Instant> slots = Schedule.slots(m, at(5, 0, 0), at(6, 23, 59));
        assertThat(slots).containsExactly(at(5, 8, 0), at(5, 20, 0), at(6, 8, 0), at(6, 20, 0));
        assertThat(slots.get(0)).isEqualTo(Instant.parse("2026-11-05T02:00:00Z"));
    }

    @Test
    @DisplayName("only the chosen weekdays, never before the first day or after the last")
    void daysAndRange() {
        // 2 Nov 2026 is a Monday. Mondays and Thursdays only, 4 to 12 November.
        Medication m = medication(List.of("09:00"), List.of(true, false, false, true, false, false, false), LocalDate.of(2026, 11, 4), LocalDate.of(2026, 11, 12));
        List<Instant> slots = Schedule.slots(m, at(1, 0, 0), at(30, 0, 0));
        assertThat(slots).containsExactly(at(5, 9, 0), at(9, 9, 0), at(12, 9, 0));
    }

    @Test
    @DisplayName("a moment is a dose time only if the schedule says so")
    void isSlot() {
        Medication m = medication(List.of("08:00"), List.of(true, true, true, true, true, true, true), LocalDate.of(2026, 11, 1), null);
        assertThat(Schedule.isSlot(m, at(5, 8, 0))).isTrue();
        assertThat(Schedule.isSlot(m, at(5, 8, 1))).isFalse();
        assertThat(Schedule.isSlot(m, at(5, 9, 0))).isFalse();
    }
}
