package com.hearth.decision.engine;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonValue;
import com.hearth.common.family.Availability;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The decision engine's inputs and results. They mirror the TypeScript types in
 * {@code frontend/src/types/domain.ts}, so the JSON is the same as the browser's own engine produces.
 * Ids are plain text here: the engine does not care what kind of id it is given.
 */
public final class Model {

    private Model() {
    }

    /* ───────── inputs ───────── */

    public record Task(
            String id,
            String title,
            String notes,
            String category,
            String priority,
            String status,
            Instant start,
            int durationMin,
            String assigneeId,
            @JsonInclude(Include.NON_NULL) String forId,
            String visibility,
            String createdById,
            Instant createdAt,
            @JsonInclude(Include.NON_NULL) String appointmentId,
            @JsonInclude(Include.NON_NULL) Instant completedAt,
            @JsonInclude(Include.NON_NULL) String completedById,
            boolean reminder,
            @JsonInclude(Include.NON_NULL) String acknowledgedConflict) {

        @JsonIgnore
        public boolean isPrivate() {
            return "private".equals(visibility);
        }

        @JsonIgnore
        public boolean isScheduled() {
            return "scheduled".equals(status);
        }

        public Task withPlan(String newAssignee, Instant newStart) {
            return new Task(id, title, notes, category, priority, status, newStart, durationMin, newAssignee, forId, visibility, createdById, createdAt, appointmentId, completedAt, completedById, reminder, acknowledgedConflict);
        }
    }

    /** {@code provider} (the doctor or clinic) is only used for wording in the week view. */
    public record Appointment(String id, String title, Instant start, int durationMin, String forId, String escortId, String visibility, String createdById, String provider) {

        @JsonIgnore
        public boolean isPrivate() {
            return "private".equals(visibility);
        }
    }

    public record Member(String id, String name, String role, String status, List<String> skills, Availability availability) {
    }

    public record Unavailability(String id, String memberId, Instant start, Instant end, String reason) {
    }

    /** A personal event as stored: weekly ones once, with the days they happen on (Monday first). */
    public record PersonalEvent(String id, String memberId, String title, Instant start, int durationMin, String repeat, List<Boolean> days, Instant until, String visibility) {
    }

    /** One concrete block of busy time, produced by expanding personal events. */
    public record BusyBlock(String id, String eventId, String memberId, String label, boolean hidden, Instant start, Instant end) {
    }

    /**
     * Everything the engine needs, seen through {@code viewerId}'s eyes: other people's private things are
     * "a personal commitment", and clashes on private tasks are only reported to their owner.
     *
     * @param calendarOwners members who keep their own calendar in Hearth (at least one personal event)
     * @param zone           the family's time zone: "the same day", availability windows and weekly events use it
     */
    public record EngineData(
            List<Task> tasks,
            List<Appointment> appointments,
            List<Member> members,
            List<Unavailability> unavailability,
            List<BusyBlock> busy,
            Set<String> calendarOwners,
            String viewerId,
            ZoneId zone) {

        public EngineData withViewer(String viewer) {
            return new EngineData(tasks, appointments, members, unavailability, busy, calendarOwners, viewer, zone);
        }

        public EngineData withTasks(List<Task> changed) {
            return new EngineData(changed, appointments, members, unavailability, busy, calendarOwners, viewerId, zone);
        }
    }

    /* ───────── results ───────── */

    /** Why a task cannot go ahead as planned. {@code kind}: unassigned, overlap, outside-availability or reported-unavailable. */
    public record Conflict(String id, String taskId, String memberId, String kind, String reason, int overlapMinutes, @JsonInclude(Include.NON_NULL) String otherLabel) {
    }

    public record PriorityFactors(double deadline, double criticality, double dependency, double reassignment, double conflict) {
    }

    /** Task Priority Score (0–100) with the factors behind it and a plain-language explanation. */
    public record PriorityBreakdown(int score, PriorityFactors factors, String explanation) {
    }

    public record SuitabilityFactors(double availability, double workloadCapacity, double skillEligibility, double conflictCost) {
    }

    /** Candidate Suitability Score (0–100) for one member and one task. */
    public record CandidateScore(String memberId, int score, SuitabilityFactors factors, int tasksThatDay, int overlapMinutes, List<String> reasons, List<String> cautions) {
    }

    /** One task in a person's list, in the order to do them. {@code advice}: now, next or later. */
    public record RankedTask(
            Task task,
            int rank,
            PriorityBreakdown priority,
            @JsonInclude(Include.NON_NULL) Conflict conflict,
            String advice,
            @JsonInclude(Include.NON_NULL) String tieBreak,
            long startsInMin) {
    }

    /**
     * A what-if change. {@code changeAssignee} tells "give it to nobody" (assignee null) apart from "leave
     * the assignee as it is" (no assignee in the request).
     */
    public record SimulationChange(String taskId, boolean changeAssignee, String assigneeId, Instant start) {

        @JsonValue
        public Map<String, Object> json() {
            Map<String, Object> json = new LinkedHashMap<>();
            json.put("taskId", taskId);
            if (changeAssignee) {
                json.put("assigneeId", assigneeId);
            }
            if (start != null) {
                json.put("start", start);
            }
            return json;
        }
    }

    public record Workload(String memberId, long before, long after) {
    }

    public record SimulationResult(SimulationChange change, List<Conflict> conflictsBefore, List<Conflict> conflictsAfter, List<Conflict> resolved, List<Conflict> introduced, List<Workload> workload) {
    }
}
