package com.hearth.common.text;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FormatsTest {

    private static final ZoneId UTC = ZoneOffset.UTC;
    private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");
    private static final ZoneId DHAKA = ZoneId.of("Asia/Dhaka");

    @Test
    @DisplayName("dayTime formats instant into 'EEE, MMM d, h:mm a' in target time zone")
    void dayTimeFormatsCorrectly() {
        // 2026-10-19 17:00:00 UTC (Monday)
        Instant instant = LocalDateTime.of(2026, 10, 19, 17, 0, 0).toInstant(ZoneOffset.UTC);

        assertThat(Formats.dayTime(instant, UTC)).isEqualTo("Mon, Oct 19, 5:00 PM");
        // In New York (EDT, UTC-4), 17:00 UTC is 13:00 (1:00 PM)
        assertThat(Formats.dayTime(instant, NEW_YORK)).isEqualTo("Mon, Oct 19, 1:00 PM");
        // In Dhaka (BST, UTC+6), 17:00 UTC is 23:00 (11:00 PM)
        assertThat(Formats.dayTime(instant, DHAKA)).isEqualTo("Mon, Oct 19, 11:00 PM");
    }

    @Test
    @DisplayName("dayTime returns empty string when instant is null")
    void dayTimeReturnsEmptyOnNull() {
        assertThat(Formats.dayTime(null, UTC)).isEmpty();
    }

    @Test
    @DisplayName("time formats instant into 'h:mm a' in target time zone")
    void timeFormatsCorrectly() {
        Instant instant = LocalDateTime.of(2026, 10, 19, 9, 30, 0).toInstant(ZoneOffset.UTC);

        assertThat(Formats.time(instant, UTC)).isEqualTo("9:30 AM");
        // In New York (UTC-4), 9:30 UTC is 5:30 AM
        assertThat(Formats.time(instant, NEW_YORK)).isEqualTo("5:30 AM");
        // In Dhaka (UTC+6), 9:30 UTC is 3:30 PM
        assertThat(Formats.time(instant, DHAKA)).isEqualTo("3:30 PM");
    }

    @Test
    @DisplayName("time returns empty string when instant is null")
    void timeReturnsEmptyOnNull() {
        assertThat(Formats.time(null, UTC)).isEmpty();
    }

    @Test
    @DisplayName("trim removes surrounding whitespace and handles null")
    void trimHandlesWhitespaceAndNull() {
        assertThat(Formats.trim("  hello world  ")).isEqualTo("hello world");
        assertThat(Formats.trim(null)).isEmpty();
        assertThat(Formats.trim("")).isEmpty();
        assertThat(Formats.trim("   ")).isEmpty();
    }

    @Test
    @DisplayName("blankToNull returns null for empty/blank values and trims non-blank values")
    void blankToNullConvertsProperly() {
        assertThat(Formats.blankToNull(null)).isNull();
        assertThat(Formats.blankToNull("")).isNull();
        assertThat(Formats.blankToNull("   \t\n  ")).isNull();
        assertThat(Formats.blankToNull("  Hearth  ")).isEqualTo("Hearth");
    }

    @Test
    @DisplayName("clip limits string length and handles null & edge cases")
    void clipTruncatesProperly() {
        assertThat(Formats.clip(null, 10)).isEmpty();
        assertThat(Formats.clip("Hearth", 10)).isEqualTo("Hearth");
        assertThat(Formats.clip("Hearth", 6)).isEqualTo("Hearth");
        assertThat(Formats.clip("Hearth System", 6)).isEqualTo("Hearth");
        assertThat(Formats.clip("Hearth", 0)).isEmpty();
    }
}
