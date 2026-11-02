package com.hearth.task.calendar;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.Names;
import com.hearth.task.domain.PersonalEvent;
import com.hearth.task.domain.Task;
import com.hearth.task.domain.Unavailability;
import com.hearth.task.repository.PersonalEventRepository;
import com.hearth.task.repository.TaskRepository;
import com.hearth.task.repository.UnavailabilityRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A member's own plan as a calendar their phone can subscribe to: the tasks they do, their own events
 * (weekly ones expanded) and their time away. The address is a long random secret; whoever has it can read
 * the calendar, so it can be replaced or switched off at any time.
 */
@Service
public class CalendarService {

    static final Duration PAST = Duration.ofDays(30);
    static final Duration AHEAD = Duration.ofDays(180);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Map<String, String> CATEGORY_NAMES = Map.ofEntries(
            Map.entry("medication", "Medicine"), Map.entry("health", "Health"), Map.entry("meals", "Meals"), Map.entry("errands", "Errands"),
            Map.entry("household", "Household"), Map.entry("childcare", "Childcare"), Map.entry("transport", "Transport"), Map.entry("study", "Study"),
            Map.entry("work", "Work"), Map.entry("exercise", "Exercise"), Map.entry("family", "Family"), Map.entry("other", "Other"));

    private final FamilyDirectory directory;
    private final CalendarFeedRepository feeds;
    private final TaskRepository tasks;
    private final PersonalEventRepository events;
    private final UnavailabilityRepository away;
    private final Clock clock;
    private final String appUrl;

    public CalendarService(FamilyDirectory directory, CalendarFeedRepository feeds, TaskRepository tasks, PersonalEventRepository events, UnavailabilityRepository away,
                           Clock clock, @Value("${hearth.app-url:http://localhost:8000}") String appUrl) {
        this.directory = directory;
        this.feeds = feeds;
        this.tasks = tasks;
        this.events = events;
        this.away = away;
        this.clock = clock;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    /** @param token only set right after the address was made; it is never shown again */
    public record FeedStatus(boolean active, Instant createdAt, Instant lastFetchedAt, @JsonInclude(JsonInclude.Include.NON_NULL) String token) {
    }

    @Transactional(readOnly = true)
    public FeedStatus status() {
        FamilyContext context = directory.context();
        return feeds.findById(context.memberId())
                .map(f -> new FeedStatus(true, f.getCreatedAt(), f.getLastFetchedAt(), null))
                .orElse(new FeedStatus(false, null, null, null));
    }

    /** Makes a new address (replacing any old one) and returns its token once. */
    @Transactional
    public FeedStatus create() {
        FamilyContext context = directory.context();
        byte[] secret = new byte[32];
        RANDOM.nextBytes(secret);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        String label = "Hearth – " + Names.first(context.memberName());
        Instant now = Instant.now(clock);
        CalendarFeed feed = feeds.findById(context.memberId()).orElse(null);
        if (feed == null) {
            feed = feeds.save(new CalendarFeed(context.memberId(), context.familyId(), hash(token), label, context.zone().getId(), now));
        } else {
            feed.rotate(hash(token), label, context.zone().getId(), now);
        }
        return new FeedStatus(true, feed.getCreatedAt(), null, token);
    }

    @Transactional
    public void remove() {
        FamilyContext context = directory.context();
        feeds.deleteById(context.memberId());
    }

    /** The calendar for a token, or "not found" for a wrong or revoked one (never saying which). */
    @Transactional
    public Optional<String> render(String token) {
        if (token == null || token.length() < 40 || token.length() > 64) {
            return Optional.empty();
        }
        Optional<CalendarFeed> found = feeds.findByTokenHash(hash(token));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        CalendarFeed feed = found.get();
        Instant now = Instant.now(clock);
        // Calendar apps fetch every few minutes to hours; recording each fetch is enough to show "last synced".
        if (feed.getLastFetchedAt() == null || feed.getLastFetchedAt().isBefore(now.minus(Duration.ofMinutes(5)))) {
            feed.fetched(now);
        }
        return Optional.of(write(feed, now));
    }

    String write(CalendarFeed feed, Instant now) {
        ZoneId zone = zone(feed.getTimezone());
        Instant from = now.minus(PAST);
        Instant to = now.plus(AHEAD);
        IcsWriter ics = new IcsWriter()
                .begin("VCALENDAR")
                .raw("VERSION", "2.0")
                .raw("PRODID", "-//Hearth//Family organiser//EN")
                .raw("CALSCALE", "GREGORIAN")
                .raw("METHOD", "PUBLISH")
                .text("X-WR-CALNAME", feed.getLabel())
                .text("X-WR-TIMEZONE", zone.getId())
                .raw("X-PUBLISHED-TTL", "PT1H")
                .raw("REFRESH-INTERVAL;VALUE=DURATION", "PT1H");

        for (Task task : tasks.findByFamilyIdAndAssigneeId(feed.getFamilyId(), feed.getMemberId())) {
            if (Task.CANCELLED.equals(task.getStatus()) || task.getEndAt().isBefore(from) || task.getStartAt().isAfter(to)) {
                continue;
            }
            ics.begin("VEVENT")
                    .raw("UID", "task-" + task.getId() + "@hearth")
                    .time("DTSTAMP", now)
                    .time("DTSTART", task.getStartAt())
                    .time("DTEND", task.getEndAt())
                    .text("SUMMARY", (Task.COMPLETED.equals(task.getStatus()) ? "✓ " : "") + task.getTitle())
                    .text("DESCRIPTION", description(task))
                    .text("CATEGORIES", CATEGORY_NAMES.getOrDefault(task.getCategory(), "Other"))
                    .raw("CLASS", task.isShared() ? "PUBLIC" : "PRIVATE")
                    .raw("STATUS", "CONFIRMED")
                    .raw("URL", appUrl + "/tasks/" + task.getId());
            if (task.isReminder() && Task.SCHEDULED.equals(task.getStatus())) {
                ics.begin("VALARM").raw("ACTION", "DISPLAY").text("DESCRIPTION", task.getTitle()).raw("TRIGGER", "-PT15M").end("VALARM");
            }
            ics.end("VEVENT");
        }

        for (PersonalEvent event : events.findByFamilyIdAndMemberIdOrderByStartAtAsc(feed.getFamilyId(), feed.getMemberId())) {
            for (Instant start : occurrences(event, from, to, zone)) {
                String uid = event.isWeekly() ? "event-" + event.getId() + "-" + start.atZone(zone).toLocalDate() + "@hearth" : "event-" + event.getId() + "@hearth";
                ics.begin("VEVENT")
                        .raw("UID", uid)
                        .time("DTSTAMP", now)
                        .time("DTSTART", start)
                        .time("DTEND", start.plus(Duration.ofMinutes(event.getDurationMin())))
                        .text("SUMMARY", event.getTitle() == null || event.getTitle().isBlank() ? capitalise(event.getKind()) : event.getTitle())
                        .text("LOCATION", event.getLocation())
                        .text("CATEGORIES", capitalise(event.getKind()))
                        .raw("TRANSP", "OPAQUE")
                        .end("VEVENT");
            }
        }

        for (Unavailability u : away.findByFamilyIdAndMemberIdOrderByStartAtAsc(feed.getFamilyId(), feed.getMemberId())) {
            if (u.getEndAt().isBefore(from) || u.getStartAt().isAfter(to)) {
                continue;
            }
            ics.begin("VEVENT")
                    .raw("UID", "away-" + u.getId() + "@hearth")
                    .time("DTSTAMP", now)
                    .time("DTSTART", u.getStartAt())
                    .time("DTEND", u.getEndAt())
                    .text("SUMMARY", "Away" + (u.getReason() == null || u.getReason().isBlank() ? "" : ": " + u.getReason()))
                    .text("DESCRIPTION", u.getNote())
                    .raw("TRANSP", "OPAQUE")
                    .end("VEVENT");
        }
        return ics.end("VCALENDAR").toString();
    }

    /** Same expansion as the decision engine's Recurrence: weekly events on their days, at the same local time. */
    static List<Instant> occurrences(PersonalEvent event, Instant from, Instant to, ZoneId zone) {
        Instant first = event.getStartAt();
        Duration length = Duration.ofMinutes(event.getDurationMin());
        if (!event.isWeekly()) {
            return first.isBefore(to) && first.plus(length).isAfter(from) ? List.of(first) : List.of();
        }
        LocalTime timeOfDay = first.atZone(zone).toLocalTime().withSecond(0).withNano(0);
        LocalDate lastDay = event.getUntilAt() == null ? null : event.getUntilAt().atZone(zone).toLocalDate();
        LocalDate day = (first.isAfter(from) ? first : from).atZone(zone).toLocalDate().minusDays(1);
        LocalDate end = to.atZone(zone).toLocalDate();
        List<Boolean> days = event.getDays();
        List<Instant> out = new ArrayList<>();
        for (; !day.isAfter(end) && (lastDay == null || !day.isAfter(lastDay)); day = day.plusDays(1)) {
            int mondayBased = day.getDayOfWeek().getValue() - 1;
            if (days == null || mondayBased >= days.size() || !Boolean.TRUE.equals(days.get(mondayBased))) {
                continue;
            }
            Instant start = ZonedDateTime.of(day, timeOfDay, zone).toInstant();
            if (!start.isBefore(first) && start.isBefore(to) && start.plus(length).isAfter(from)) {
                out.add(start);
            }
        }
        return out;
    }

    private String description(Task task) {
        StringBuilder text = new StringBuilder();
        if (task.getNotes() != null && !task.getNotes().isBlank()) {
            text.append(task.getNotes()).append("\n\n");
        }
        text.append("Priority: ").append(task.getPriority()).append(task.isShared() ? " · shared with the family" : " · private").append('\n');
        text.append("Open in Hearth: ").append(appUrl).append("/tasks/").append(task.getId());
        return text.toString();
    }

    private static String capitalise(String text) {
        return text == null || text.isEmpty() ? "Event" : text.substring(0, 1).toUpperCase(Locale.ROOT) + text.substring(1);
    }

    private static ZoneId zone(String id) {
        try {
            return ZoneId.of(id);
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
