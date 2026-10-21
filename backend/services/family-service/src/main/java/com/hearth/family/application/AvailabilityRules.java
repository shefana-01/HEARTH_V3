package com.hearth.family.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.Availability;
import com.hearth.common.family.Availability.TimeWindow;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Checks and tidies a weekly availability: seven days (Monday first) and up to ten "HH:mm" windows. */
final class AvailabilityRules {

    private AvailabilityRules() {
    }

    /** Every day, no windows: "no fixed times". */
    static Availability everyDay() {
        return new Availability(List.of(true, true, true, true, true, true, true), List.of());
    }

    static Availability clean(Availability input) {
        if (input == null) {
            return everyDay();
        }
        List<Boolean> days = input.days();
        if (days == null || days.size() != 7 || days.stream().anyMatch(d -> d == null)) {
            throw ApiException.unprocessable("Choose the days of the week (Monday to Sunday).");
        }
        List<TimeWindow> windows = new ArrayList<>();
        for (TimeWindow window : input.windowsOrEmpty()) {
            if (window == null) {
                continue;
            }
            LocalTime start = time(window.start());
            LocalTime end = time(window.end());
            if (!end.isAfter(start)) {
                throw ApiException.unprocessable("Each time window must end after it starts.");
            }
            String id = window.id() == null || window.id().isBlank() ? UUID.randomUUID().toString() : window.id().trim();
            String label = window.label() == null ? "" : window.label().trim();
            windows.add(new TimeWindow(id.length() > 60 ? id.substring(0, 60) : id, label.length() > 40 ? label.substring(0, 40) : label, window.start().trim(), window.end().trim()));
        }
        if (windows.size() > 10) {
            throw ApiException.unprocessable("You can add up to 10 time windows.");
        }
        return new Availability(List.copyOf(days), windows);
    }

    private static LocalTime time(String value) {
        if (value == null || !value.trim().matches("\\d{2}:\\d{2}")) {
            throw ApiException.unprocessable("Times look like 09:00 or 17:30.");
        }
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw ApiException.unprocessable("Times look like 09:00 or 17:30.");
        }
    }
}
