package com.hearth.task.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match {@code Task}, {@code PersonalEvent} and {@code Unavailability} in the frontend. */
public final class TaskDtos {

    private TaskDtos() {
    }

    public static final String CATEGORIES = "medication|health|meals|errands|household|childcare|transport|study|work|exercise|family|other";

    /* ───────── tasks ───────── */

    public record TaskView(
            UUID id,
            String title,
            String notes,
            String category,
            String priority,
            String status,
            Instant start,
            int durationMin,
            UUID assigneeId,
            @JsonInclude(Include.NON_NULL) UUID forId,
            String visibility,
            UUID createdById,
            Instant createdAt,
            @JsonInclude(Include.NON_NULL) UUID appointmentId,
            @JsonInclude(Include.NON_NULL) Instant completedAt,
            @JsonInclude(Include.NON_NULL) UUID completedById,
            boolean reminder,
            @JsonInclude(Include.NON_NULL) String acknowledgedConflict) {
    }

    public record TaskInput(
            @NotBlank(message = "Give the task a name.") @Size(max = 120, message = "Task names can be up to 120 characters.") String title,
            @Size(max = 2000, message = "Notes can be up to 2000 characters.") String notes,
            @NotNull(message = "Choose what kind of task it is.") @Pattern(regexp = CATEGORIES, message = "Choose what kind of task it is.") String category,
            @NotNull(message = "Choose how important it is.") @Pattern(regexp = "routine|important|urgent", message = "Choose how important it is.") String priority,
            @NotNull(message = "Choose a date and time.") Instant start,
            @Min(value = 5, message = "A task takes at least 5 minutes.") @Max(value = 1440, message = "A task can take up to 24 hours.") int durationMin,
            UUID assigneeId,
            UUID forId,
            @NotNull(message = "Choose who can see this task.") @Pattern(regexp = "family|private", message = "Choose who can see this task.") String visibility,
            UUID appointmentId,
            boolean reminder) {
    }

    public record AssigneeRequest(UUID memberId) {
    }

    /* ───────── personal events ───────── */

    public record EventView(
            UUID id,
            UUID memberId,
            String title,
            String kind,
            Instant start,
            int durationMin,
            String repeat,
            List<Boolean> days,
            @JsonInclude(Include.NON_NULL) Instant until,
            String location,
            String visibility,
            Instant createdAt) {
    }

    public record EventInput(
            @Size(max = 120, message = "Event names can be up to 120 characters.") String title,
            @NotNull(message = "Choose what kind of event it is.") @Pattern(regexp = "class|work|personal|travel|other", message = "Choose what kind of event it is.") String kind,
            @NotNull(message = "Choose a date and time.") Instant start,
            int durationMin,
            @NotNull @Pattern(regexp = "none|weekly", message = "Choose whether it repeats.") String repeat,
            List<Boolean> days,
            Instant until,
            @Size(max = 200) String location,
            @NotNull @Pattern(regexp = "details|busy", message = "Choose what the family can see.") String visibility) {
    }

    /* ───────── time away ───────── */

    public record UnavailabilityView(UUID id, UUID memberId, Instant start, Instant end, String reason, String note, Instant createdAt) {
    }

    public record UnavailabilityInput(
            @NotNull(message = "Choose when it starts.") Instant start,
            @NotNull(message = "Choose when it ends.") Instant end,
            @Size(max = 60) String reason,
            @Size(max = 500, message = "Notes can be up to 500 characters.") String note) {
    }

    /**
     * @param affectedTaskIds shared tasks that now need someone else
     * @param requestIds      always empty here: decision-service opens the handover requests a moment later
     * @param personalTaskIds private tasks in the same time, which only their owner can move
     */
    public record UnavailabilityResult(UnavailabilityView unavailability, List<UUID> affectedTaskIds, List<UUID> requestIds, List<UUID> personalTaskIds) {
    }

    /* ───────── for decision-service (internal) ───────── */

    /**
     * Everything the decision engine needs about a family's time. Times and people are always real, because
     * a clash with someone's private commitment must be found; what a private item is about is blanked
     * for anyone who may not see it.
     */
    public record PlanningData(List<TaskView> tasks, List<EventView> events, List<UnavailabilityView> unavailability) {
    }

    /** A change decided in decision-service: a new assignee (when {@code changeAssignee}) and/or a new start. */
    public record PlanChange(boolean changeAssignee, UUID assigneeId, Instant start) {
    }

    public record AcknowledgeRequest(@NotBlank @Pattern(regexp = "unassigned|overlap|outside-availability|reported-unavailable") String kind) {
    }
}
