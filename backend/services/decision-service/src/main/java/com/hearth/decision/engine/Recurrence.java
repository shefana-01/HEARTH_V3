package com.hearth.decision.engine;

import com.hearth.decision.engine.Model.BusyBlock;
import com.hearth.decision.engine.Model.PersonalEvent;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Turns personal events into concrete blocks of busy time. A weekly event ("Data Structures, Sun & Tue
 * 10:00") is stored once and expanded for the range being looked at, in the family's time zone.
 *
 * A line-by-line port of {@code frontend/src/lib/recurrence.ts}; DecisionEngineParityTest checks that both
 * give the same blocks.
 */
public final class Recurrence {

    /** How far back and ahead the decision engine looks for busy time. */
    public static final Duration LOOKBACK = Duration.ofDays(1);
    public static final Duration HORIZON = Duration.ofDays(45);

    private Recurrence() {
    }

    /** Every occurrence of {@code events} that overlaps [from, to), earliest first. */
    public static List<BusyBlock> expand(List<PersonalEvent> events, Instant from, Instant to, ZoneId zone) {
        List<BusyBlock> blocks = new ArrayList<>();
        for (PersonalEvent event : events) {
            Instant first = event.start();
            Duration length = Duration.ofMinutes(event.durationMin());
            boolean hidden = "busy".equals(event.visibility());

            if (!"weekly".equals(event.repeat())) {
                if (first.isBefore(to) && first.plus(length).isAfter(from)) {
                    blocks.add(new BusyBlock(event.id(), event.id(), event.memberId(), event.title(), hidden, first, first.plus(length)));
                }
                continue;
            }

            LocalTime timeOfDay = first.atZone(zone).toLocalTime().withSecond(0).withNano(0);
            Instant lastDay = event.until() == null ? null : startOfDay(event.until(), zone).toInstant();
            // Start one day early so an occurrence that began yesterday and runs past midnight is included.
            Instant earliest = first.isAfter(from.minus(Duration.ofDays(1))) ? first : from.minus(Duration.ofDays(1));
            for (ZonedDateTime day = startOfDay(earliest, zone);
                    day.toInstant().isBefore(to) && (lastDay == null || !day.toInstant().isAfter(lastDay));
                    day = day.toLocalDate().plusDays(1).atStartOfDay(zone)) {
                int mondayBased = day.getDayOfWeek().getValue() - 1;
                if (event.days() == null || mondayBased >= event.days().size() || !Boolean.TRUE.equals(event.days().get(mondayBased))) {
                    continue;
                }
                Instant start = day.toLocalDate().atTime(timeOfDay).atZone(zone).toInstant();
                if (start.isBefore(first) || !start.isBefore(to) || !start.plus(length).isAfter(from)) {
                    continue;
                }
                blocks.add(new BusyBlock(event.id() + "@" + dayKey(day.toLocalDate()), event.id(), event.memberId(), event.title(), hidden, start, start.plus(length)));
            }
        }
        blocks.sort(Comparator.comparing(BusyBlock::start).thenComparing(BusyBlock::id));
        return blocks;
    }

    private static ZonedDateTime startOfDay(Instant instant, ZoneId zone) {
        return instant.atZone(zone).toLocalDate().atStartOfDay(zone);
    }

    /** yyyy-mm-dd of a local date, used in occurrence ids. */
    private static String dayKey(LocalDate day) {
        return day.toString();
    }
}
