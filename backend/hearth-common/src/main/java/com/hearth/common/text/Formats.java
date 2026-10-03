package com.hearth.common.text;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Date wording used in activity-log and notification text. */
public final class Formats {

    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("EEE d MMM, h:mm a", Locale.ENGLISH);

    private Formats() {
    }

    /** e.g. "Tue 6 Oct, 5:00 PM", in the family's time zone. */
    public static String dayTime(Instant instant, ZoneId zone) {
        return instant == null ? "" : DAY_TIME.format(instant.atZone(zone));
    }

    public static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
