package com.hearth.decision.application;

import com.hearth.common.error.ApiException;
import com.hearth.decision.application.Planning.Snapshot;
import com.hearth.decision.dto.DecisionDtos.ScheduleEvent;
import com.hearth.decision.engine.DecisionEngine;
import com.hearth.decision.engine.Model.Appointment;
import com.hearth.decision.engine.Model.BusyBlock;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.engine.Model.Unavailability;
import com.hearth.decision.engine.Recurrence;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * The family's week: tasks, appointments, personal events and time away between two times. Other people's
 * private items come back as plain "Busy" blocks. A port of {@code getWeek} in the frontend's scheduleService.ts.
 */
@Service
public class WeekService {

    private final Planning planning;

    public WeekService(Planning planning) {
        this.planning = planning;
    }

    public List<ScheduleEvent> between(Instant from, Instant to) {
        if (!to.isAfter(from) || Duration.between(from, to).toDays() > 62) {
            throw ApiException.unprocessable("Choose a range of up to two months.");
        }
        Snapshot s = planning.load();
        String me = s.me();
        Set<String> conflicted = DecisionEngine.detectConflicts(s.data(), s.now()).stream().map(Conflict::taskId).collect(Collectors.toSet());
        List<ScheduleEvent> events = new ArrayList<>();

        for (Task t : s.data().tasks()) {
            if ("cancelled".equals(t.status()) || !inRange(t.start(), from, to)) {
                continue;
            }
            Instant end = t.start().plus(Duration.ofMinutes(t.durationMin()));
            boolean visible = !t.isPrivate() || me.equals(t.assigneeId()) || me.equals(t.createdById());
            if (!visible) {
                events.add(busy(t.id(), t.assigneeId(), t.start(), end));
                continue;
            }
            String kind = "completed".equals(t.status()) ? "completed" : conflicted.contains(t.id()) ? "conflict" : "task";
            String subtitle = t.isPrivate() ? "Private" : t.assigneeId() != null ? s.firstName(t.assigneeId()) : "Needs someone";
            events.add(new ScheduleEvent(t.id(), kind, t.title(), subtitle, t.start(), end, t.assigneeId(), null, "/tasks/" + t.id()));
        }

        for (Appointment a : s.data().appointments()) {
            if (!inRange(a.start(), from, to)) {
                continue;
            }
            Instant end = a.start().plus(Duration.ofMinutes(a.durationMin()));
            String attendee = s.member(a.forId()).isPresent() ? a.forId() : null;
            String memberId = attendee != null ? attendee : a.escortId();
            boolean visible = !a.isPrivate() || me.equals(a.forId()) || me.equals(a.escortId()) || me.equals(a.createdById());
            if (!visible) {
                events.add(busy(a.id(), memberId, a.start(), end));
                continue;
            }
            String forFirst = s.name(a.forId()).split(" ", -1)[0];
            String also = attendee != null && a.escortId() != null && !a.escortId().equals(attendee) ? a.escortId() : null;
            events.add(new ScheduleEvent(a.id(), "appointment", a.title(), "For " + forFirst + providerSuffix(a), a.start(), end, memberId, also, "/appointments/" + a.id()));
        }

        for (BusyBlock b : Recurrence.expand(s.events(), from, to, s.context().zone())) {
            if (b.hidden() && !b.memberId().equals(me)) {
                events.add(busy(b.id(), b.memberId(), b.start(), b.end()));
            } else {
                events.add(new ScheduleEvent(b.id(), "event", b.label(), s.firstName(b.memberId()), b.start(), b.end(), b.memberId(), null, b.memberId().equals(me) ? "/schedule/events/" + b.eventId() : null));
            }
        }

        for (Unavailability u : s.data().unavailability()) {
            if (!inRange(u.start(), from, to)) {
                continue;
            }
            events.add(new ScheduleEvent(u.id(), "unavailable", s.firstName(u.memberId()) + " unavailable", u.reason() == null || u.reason().isEmpty() ? null : u.reason(), u.start(), u.end(), u.memberId(), null, null));
        }

        events.sort(Comparator.comparing(ScheduleEvent::start).thenComparing(ScheduleEvent::id));
        return events;
    }

    /** "For Rahima · Dr. Karim", or "For Rahima" when no doctor or clinic was given. */
    private static String providerSuffix(Appointment a) {
        return a.provider() == null || a.provider().isBlank() ? "" : " · " + a.provider();
    }

    private static boolean inRange(Instant time, Instant from, Instant to) {
        return !time.isBefore(from) && time.isBefore(to);
    }

    private static ScheduleEvent busy(String id, String memberId, Instant start, Instant end) {
        return new ScheduleEvent(id, "busy", "Busy", null, start, end, memberId, null, null);
    }
}
