package com.hearth.task.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class IcsWriterTest {

    @Test
    @DisplayName("text values escape backslashes, semicolons, commas and newlines")
    void escaping() {
        assertThat(IcsWriter.escape("a\\b;c,d\ne")).isEqualTo("a\\\\b\\;c\\,d\\ne");
    }

    @Test
    @DisplayName("long lines fold at 75 octets with CRLF + space, never inside a Bengali character")
    void foldingKeepsUtf8Intact() {
        String title = "ডাক্তারের কাছে দাদুকে নিয়ে যাওয়া এবং ওষুধ কিনে আনা, তারপর বাজার করা";
        String out = new IcsWriter().text("SUMMARY", title).toString();
        String[] lines = out.split("\r\n");
        assertThat(lines.length).isGreaterThan(1);
        for (String line : lines) {
            assertThat(line.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75);
        }
        StringBuilder unfolded = new StringBuilder(lines[0]);
        for (int i = 1; i < lines.length; i++) {
            assertThat(lines[i]).startsWith(" ");
            unfolded.append(lines[i].substring(1));
        }
        assertThat(unfolded.toString()).isEqualTo("SUMMARY:" + IcsWriter.escape(title));
    }

    @Test
    @DisplayName("times are written in UTC basic format and blank text is left out")
    void timesAndBlanks() {
        String out = new IcsWriter().time("DTSTART", Instant.parse("2026-11-05T04:30:00Z")).text("LOCATION", "  ").toString();
        assertThat(out).isEqualTo("DTSTART:20261105T043000Z\r\n");
    }
}
