package com.hearth.care.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class CareDtos {

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
