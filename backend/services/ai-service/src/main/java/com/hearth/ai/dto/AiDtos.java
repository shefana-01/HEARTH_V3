package com.hearth.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match {@code aiService.ts} in the frontend. */
public final class AiDtos {

    private AiDtos() {
    }

    /**
     * @param enabled                  AI help is configured on this server
     * @param consented                the caller agreed to use it
     * @param usedToday                requests the caller made today
     * @param dailyLimit               requests allowed per person per day
     * @param monthlyBudgetUsedPercent share of the family's monthly allowance already used
     */
    public record AiStatus(boolean enabled, boolean consented, @JsonInclude(Include.NON_NULL) Instant consentedAt, long usedToday, int dailyLimit, int monthlyBudgetUsedPercent) {
    }

    public record ConsentRequest(@NotNull(message = "Say whether to turn AI help on or off.") Boolean granted) {
    }

    /* ───────── quick add ───────── */

    public record QuickAddRequest(
            @NotBlank(message = "Write or say what needs doing.") @Size(max = 600, message = "Keep it to 600 characters or fewer.") String text) {
    }

    /** A task ready to be saved through task-service; the same fields as {@code TaskInput} plus {@code reason}. */
    public record TaskDraft(
            String title,
            String notes,
            String category,
            String priority,
            Instant start,
            int durationMin,
            UUID assigneeId,
            @JsonInclude(Include.NON_NULL) UUID forId,
            String visibility,
            boolean reminder,
            @JsonInclude(Include.NON_NULL) String reason) {

        public TaskDraft(String title, String notes, String category, String priority, Instant start, int durationMin, UUID assigneeId, UUID forId, String visibility, boolean reminder) {
            this(title, notes, category, priority, start, durationMin, assigneeId, forId, visibility, reminder, null);
        }
    }

    /** @param assumptions what was guessed (a missing time, a name that did not match), shown under the drafts */
    public record QuickAddResult(List<TaskDraft> drafts, List<String> assumptions) {
    }

    /* ───────── plan ───────── */

    public record PlanRequest(
            @Size(max = 500, message = "Keep instructions to 500 characters or fewer.") String instructions) {
    }

    /**
     * One suggested change. {@code move} and {@code hand-over} were run through the decision engine's
     * what-if check: {@code resolves} and {@code introduces} count the clashes it fixes and creates.
     *
     * @param action do-first, move or hand-over
     */
    public record PlanSuggestion(
            String id,
            UUID taskId,
            String taskTitle,
            String action,
            @JsonInclude(Include.NON_NULL) Instant start,
            @JsonInclude(Include.NON_NULL) UUID assigneeId,
            String reason,
            int resolves,
            int introduces) {
    }

    public record PlanResult(String summary, List<PlanSuggestion> suggestions, Instant generatedAt) {
    }

    /* ───────── chat ───────── */

    public record ChatRequest(
            @NotBlank(message = "Write a question or instruction for the assistant.")
            @Size(max = 600, message = "Keep your message to 600 characters or fewer.") String message) {
    }

    public record ChatResult(
            String reply,
            @JsonInclude(Include.NON_EMPTY) List<String> reasoning,
            @JsonInclude(Include.NON_EMPTY) List<TaskDraft> drafts,
            @JsonInclude(Include.NON_EMPTY) List<PlanSuggestion> suggestions) {
    }

    /* ───────── drafts ───────── */

    public static final String DRAFT_KINDS = "handover-request|reminder|chat-message|weekly-summary";

    /**
     * @param taskId     the task a handover request or reminder is about
     * @param toMemberId who the message is for, if anyone in particular
     * @param points     what the person wants to say, in their own words
     */
    public record DraftRequest(
            @NotNull(message = "Choose what to write.") @Pattern(regexp = DRAFT_KINDS, message = "Choose what to write.") String kind,
            UUID taskId,
            UUID toMemberId,
            @Size(max = 500, message = "Keep your points to 500 characters or fewer.") String points,
            @Pattern(regexp = "friendly|formal|short", message = "Choose a tone.") String tone,
            @Pattern(regexp = "en|bn", message = "Choose English or Bengali.") String language) {
    }

    public record DraftResult(String text) {
    }
}
