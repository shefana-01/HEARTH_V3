package com.hearth.task.calendar;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Writes iCalendar (RFC 5545) text: CRLF line endings, lines folded at 75 octets without splitting a UTF-8
 * character, and text values escaped. All times are UTC, so no VTIMEZONE is needed.
 */
public final class IcsWriter {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final int MAX_OCTETS = 75;

    private final StringBuilder out = new StringBuilder();

    public IcsWriter begin(String component) {
        return line("BEGIN:" + component);
    }

    public IcsWriter end(String component) {
        return line("END:" + component);
    }

    /** A property whose value is written as is (already valid iCalendar). */
    public IcsWriter raw(String name, String value) {
        return line(name + ":" + value);
    }

    /** A TEXT property: backslash, semicolon, comma and newlines are escaped. */
    public IcsWriter text(String name, String value) {
        if (value == null || value.isBlank()) {
            return this;
        }
        return line(name + ":" + escape(value));
    }

    public IcsWriter time(String name, Instant instant) {
        return line(name + ":" + UTC.format(instant));
    }

    public static String escape(String value) {
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n");
    }

    /** Folds one content line: continuation lines start with a single space (RFC 5545 section 3.1). */
    IcsWriter line(String content) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= MAX_OCTETS) {
            out.append(content).append("\r\n");
            return this;
        }
        int limit = MAX_OCTETS;
        int octets = 0;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < content.length(); ) {
            int codePoint = content.codePointAt(i);
            int size = new String(Character.toChars(codePoint)).getBytes(StandardCharsets.UTF_8).length;
            if (octets + size > limit) {
                out.append(current).append("\r\n ");
                current.setLength(0);
                octets = 0;
                limit = MAX_OCTETS - 1;
            }
            current.appendCodePoint(codePoint);
            octets += size;
            i += Character.charCount(codePoint);
        }
        out.append(current).append("\r\n");
        return this;
    }

    @Override
    public String toString() {
        return out.toString();
    }
}
