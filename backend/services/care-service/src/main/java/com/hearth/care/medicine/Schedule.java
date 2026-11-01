package com.hearth.care.medicine;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/** The doses a medicine schedule asks for: each chosen day between start and end, at each local time. */
public final class Schedule {

    private Schedule() {
    }

    /** Every dose time in [from, to], earliest first. */
    public static List<Instant> slots(Medication medication, Instant from, Instant to) {
        ZoneId zone = zone(medication.getTimezone());
        List<LocalTime> times = medication.getTimes().stream().map(LocalTime::parse).sorted().toList();
        LocalDate day = from.atZone(zone).toLocalDate().minusDays(1);
        LocalDate last = to.atZone(zone).toLocalDate();
        if (day.isBefore(medication.getStartDate())) {
            day = medication.getStartDate();
        }
        if (medication.getEndDate() != null && medication.getEndDate().isBefore(last)) {
            last = medication.getEndDate();
        }
        List<Instant> out = new ArrayList<>();
        for (; !day.isAfter(last); day = day.plusDays(1)) {
            int mondayBased = day.getDayOfWeek().getValue() - 1;
            if (mondayBased >= medication.getDays().size() || !Boolean.TRUE.equals(medication.getDays().get(mondayBased))) {
                continue;
            }
            for (LocalTime time : times) {
                Instant slot = ZonedDateTime.of(day, time, zone).toInstant();
                if (!slot.isBefore(from) && !slot.isAfter(to)) {
                    out.add(slot);
                }
            }
        }
        return out;
    }

    /** True if a dose is scheduled at exactly this moment. */
    public static boolean isSlot(Medication medication, Instant at) {
        return slots(medication, at, at).contains(at);
    }

    public static ZoneId zone(String id) {
        try {
            return id == null ? ZoneOffset.UTC : ZoneId.of(id);
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }
}
