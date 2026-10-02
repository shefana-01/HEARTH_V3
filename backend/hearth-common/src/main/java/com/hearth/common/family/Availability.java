package com.hearth.common.family;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Weekly availability. {@code days} is Monday to Sunday; windows are "HH:mm" in the family's time zone. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Availability(List<Boolean> days, List<TimeWindow> windows) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TimeWindow(String id, String label, String start, String end) {
    }

    public static Availability weekdays() {
        return new Availability(List.of(true, true, true, true, true, false, false), List.of());
    }

    public List<TimeWindow> windowsOrEmpty() {
        return windows == null ? List.of() : windows;
    }

    public boolean availableOn(int mondayBasedDay) {
        return days != null && mondayBasedDay >= 0 && mondayBasedDay < days.size() && Boolean.TRUE.equals(days.get(mondayBasedDay));
    }
}
