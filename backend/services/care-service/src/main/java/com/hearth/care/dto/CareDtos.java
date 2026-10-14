package com.hearth.care.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match the frontend's care types. */
public final class CareDtos {

    private CareDtos() {
    }

    /* ───────── appointments ───────── */

    public record PrepItemView(String id, String label, boolean done, @JsonInclude(JsonInclude.Include.NON_NULL) String doneById) {
    }

    /**
     * @param forId   who the visit is for: a member or someone the family looks after
     * @param escortId a member going along, if anyone
     */
    public record AppointmentView(
            UUID id,
            String title,
            String specialty,
            Instant start,
            int durationMin,
            String provider,
            String location,
            UUID forId,
            UUID escortId,
            String visibility,
            List<PrepItemView> prep,
            String note,
            UUID createdById,
            Instant createdAt) {
    }

    /** {@code prep} (a list of labels) is only used when creating; the checklist has its own endpoints afterwards. */
    public record AppointmentInput(
            @NotBlank(message = "Enter a title.") @Size(max = 120) String title,
            @Size(max = 80) String specialty,
            @NotNull(message = "Choose a date and time.") Instant start,
            @Min(value = 5, message = "A visit must last at least 5 minutes.") @Max(1440) int durationMin,
            @Size(max = 120) String provider,
            @Size(max = 200) String location,
            UUID forId,
            UUID escortId,
            @NotNull(message = "Choose who can see this appointment.") @Pattern(regexp = "family|private", message = "Choose who can see this appointment.") String visibility,
            List<String> prep,
            @Size(max = 1000) String note) {
    }

    public record PrepLabel(@NotBlank(message = "Enter what to prepare.") @Size(max = 160) String label) {
    }

    /* ───────── health notes & food suggestions ───────── */

    /** One entry of the fixed list of health notes ({@code conditions.json}). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ConditionOption(String id, String label, String summary, List<String> tags) {
    }

    public record GoalView(String id, String title, String target, List<String> tags) {
    }

    /** A goal as sent by the browser. One without a title or without tags is dropped when the profile is saved. */
    public record GoalInput(@Size(max = 60) String id, @Size(max = 120) String title, @Size(max = 200) String target, List<String> tags) {
    }

    public record HealthProfileView(
            UUID personId,
            List<String> conditions,
            List<GoalView> goals,
            List<String> avoid,
            List<String> preferences,
            String notes,
            boolean shared,
            Instant updatedAt) {
    }

    public record HealthProfileInput(
            List<String> conditions,
            @Valid List<GoalInput> goals,
            List<String> avoid,
            List<String> preferences,
            @Size(max = 1000, message = "Notes must be 1000 characters or fewer.") String notes,
            boolean shared) {
    }

    /** One entry of the reference food list ({@code foods.json}). Not medical advice. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FoodOption(
            String id,
            String name,
            @JsonInclude(JsonInclude.Include.NON_NULL) String localName,
            String group,
            List<String> tags,
            String description,
            String portion,
            double estimatedPrice,
            List<String> alternatives) {
    }

    /** Whose note a food matches and which one ({@code because} is a condition label or a goal title). */
    public record SuggestionReason(UUID personId, String because, List<String> tags) {
    }

    public record FoodSuggestion(
            String id,
            String name,
            @JsonInclude(JsonInclude.Include.NON_NULL) String localName,
            String group,
            List<String> tags,
            String description,
            String portion,
            double estimatedPrice,
            List<String> alternatives,
            List<SuggestionReason> reasons,
            boolean onList) {
    }

    /* ───────── shopping list ───────── */

    public record GroceryView(
            UUID id,
            String name,
            String group,
            int quantity,
            String unit,
            double estimatedPrice,
            String status,
            @JsonInclude(JsonInclude.Include.NON_NULL) String foodId,
            List<String> forIds,
            @JsonInclude(JsonInclude.Include.NON_NULL) String reason,
            @JsonInclude(JsonInclude.Include.NON_NULL) UUID addedById) {
    }

    /**
     * @param forIds who it is for; people whose health notes are private are left off the shared list
     * @param tags   what it is good for, shown on the list (only the tags the food really has)
     */
    public record AddFoodRequest(@NotBlank String foodId, List<UUID> forIds, List<String> tags) {
    }

    public record CustomItemRequest(@Size(max = 120) String name, int quantity, @Size(max = 60) String unit) {
    }

    public record GroceryPatch(Integer quantity, @Pattern(regexp = "needed|in-pantry") String status) {
    }

    public record GroceryTaskRequest(UUID assigneeId, @NotNull(message = "Choose when to shop.") Instant start) {
    }

    /* ───────── documents ───────── */

    public record DocumentView(
            UUID id,
            String title,
            String category,
            String fileName,
            int sizeKB,
            Instant uploadedAt,
            UUID uploadedById,
            @JsonInclude(JsonInclude.Include.NON_NULL) UUID ownerId,
            String access,
            List<String> allowedIds,
            @JsonInclude(JsonInclude.Include.NON_NULL) UUID appointmentId) {
    }

    public record AccessRequest(@NotNull @Pattern(regexp = "family|restricted") String access, List<UUID> allowedIds) {
    }

    /* ───────── legacy models ───────── */

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreatePatientRequest {
        @NotNull
        private UUID familyId;
        @NotBlank
        private String firstName;
        @NotBlank
        private String lastName;
        private LocalDate dateOfBirth;
        private UUID primaryCaregiverId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateAppointmentRequest {
        @NotNull
        private UUID patientId;
        private UUID caregiverId;
        @NotBlank
        private String title;
        private String location;
        @NotNull
        private Instant scheduledTime;
        private Integer durationMinutes;
        private String notes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NutritionGoalRequest {
        @NotNull
        private UUID familyId;
        @NotBlank
        private String goalCategory;
        private Double budgetLimit;
        private String dietaryPreferences;
    }
}
