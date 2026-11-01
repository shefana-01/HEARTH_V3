package com.hearth.care.medicine;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match {@code medicationService.ts} in the frontend. */
public final class MedicineDtos {

    private MedicineDtos() {
    }

    public record MedicationView(
            UUID id,
            UUID personId,
            String name,
            String dose,
            String instructions,
            List<String> times,
            List<Boolean> days,
            LocalDate startDate,
            @JsonInclude(Include.NON_NULL) LocalDate endDate,
            @JsonInclude(Include.NON_NULL) UUID carerId,
            boolean reminders,
            boolean active,
            UUID createdById,
            Instant updatedAt) {
    }

    public record MedicationInput(
            @NotNull(message = "Choose who takes it.") UUID personId,
            @NotBlank(message = "Give the medicine a name.") @Size(max = 120, message = "Names can be up to 120 characters.") String name,
            @Size(max = 60, message = "The dose can be up to 60 characters.") String dose,
            @Size(max = 300, message = "Instructions can be up to 300 characters.") String instructions,
            @NotNull(message = "Add at least one time.") @Size(min = 1, max = 6, message = "Add between one and six times a day.") List<@Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d", message = "Times look like 08:00.") String> times,
            @NotNull @Size(min = 7, max = 7, message = "Choose the days.") List<@NotNull Boolean> days,
            @NotNull(message = "Choose when it starts.") LocalDate startDate,
            LocalDate endDate,
            UUID carerId,
            boolean reminders,
            Boolean active) {
    }

    /**
     * One scheduled dose. {@code status}: upcoming, due (around now), taken, skipped or missed.
     *
     * @param recordedById who marked it; null when Hearth recorded it as missed
     */
    public record DoseView(
            UUID medicationId,
            UUID personId,
            String name,
            String dose,
            String instructions,
            Instant scheduledAt,
            String status,
            @JsonInclude(Include.NON_NULL) UUID recordedById,
            @JsonInclude(Include.NON_NULL) Instant recordedAt) {
    }

    public record DoseInput(
            @NotNull(message = "Choose the dose.") Instant scheduledAt,
            @NotNull @Pattern(regexp = "taken|skipped", message = "Mark it as taken or skipped.") String status) {
    }

    public record EmergencyView(
            UUID personId,
            String bloodGroup,
            String allergies,
            String doctorName,
            String doctorPhone,
            String hospital,
            String notes,
            @JsonInclude(Include.NON_NULL) Instant updatedAt) {
    }

    public record EmergencyInput(
            @Pattern(regexp = "|A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-", message = "Choose a blood group.") String bloodGroup,
            @Size(max = 500, message = "Allergies can be up to 500 characters.") String allergies,
            @Size(max = 120) String doctorName,
            @Pattern(regexp = "|[+0-9 ()-]{5,30}", message = "Enter the doctor’s phone number with digits only.") String doctorPhone,
            @Size(max = 200) String hospital,
            @Size(max = 1000, message = "Notes can be up to 1000 characters.") String notes) {
    }
}
