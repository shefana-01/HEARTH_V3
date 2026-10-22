package com.hearth.common.text;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Date wording used in activity-log, notification and chat text. Stored text uses absolute dates
 * ("Mon, Oct 21, 5:00 PM") rather than "Today", because it is read later.
 */
public final class Formats {

    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("EEE, MMM d, h:mm a", Locale.US);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.US);

    private Formats() {
    }

    /** e.g. "Mon, Oct 21, 5:00 PM", in the family's time zone. */
    public static String dayTime(Instant instant, ZoneId zone) {
        return instant == null ? "" : DAY_TIME.format(instant.atZone(zone));
    }

    /** e.g. "5:00 PM", in the family's time zone. */
    public static String time(Instant instant, ZoneId zone) {
        return instant == null ? "" : TIME.format(instant.atZone(zone));
    }

    public static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Shortens text to {@code max} characters, so a long title cannot break a column limit. */
    public static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
