package com.hearth.family.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hearth.common.family.Availability;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response shapes. They match {@code frontend/src/types/domain.ts} and the family/auth services there. */
public final class FamilyDtos {

    private FamilyDtos() {
    }

    /* ───────── sign-in ───────── */

    public record SignUpRequest(
            @NotBlank(message = "Enter your name.") @Size(max = 80, message = "Names can be up to 80 characters.") String name,
            @NotBlank(message = "Enter your email address.") @Email(message = "Enter a valid email address, like name@example.com.") @Size(max = 254) String email,
            @NotBlank(message = "Create a password.") String password) {
    }

    public record SignInRequest(@NotBlank(message = "Enter your email address.") String email, @NotBlank(message = "Enter your password.") String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record TokenRequest(@NotBlank(message = "This link is not complete. Open the link from the email again.") String token) {
    }

    public record EmailRequest(@NotBlank(message = "Enter your email address.") @Size(max = 254) String email) {
    }

    public record NewPasswordRequest(@NotBlank(message = "This link is not complete. Open the link from the email again.") String token, @NotBlank(message = "Create a password.") String password) {
    }

    /** {@code memberId} is null until the account has created or joined a family. */
    public record AccountView(
            UUID id,
            UUID memberId,
            String name,
            String email,
            @JsonInclude(JsonInclude.Include.NON_NULL) String phone,
            String about,
            @JsonInclude(JsonInclude.Include.NON_NULL) String photo,
            boolean emailVerified,
            boolean whatsappAlerts) {
    }

    /** {@code isSample} is always false here: the sample family only exists in the offline demo. */
    public record SessionView(AccountView account, boolean hasFamily, boolean isSample) {
    }

    public record AuthResponse(String token, String refreshToken, SessionView session) {
    }

    /** Only the pair: the browser keeps using the session it already has. */
    public record TokenPair(String token, String refreshToken) {
    }

    /* ───────── family ───────── */

    public record DependantView(UUID id, String name, String relation, @JsonInclude(JsonInclude.Include.NON_NULL) Integer birthYear, String notes) {
    }

    public record DependantInput(
            @NotBlank(message = "Enter their name.") @Size(max = 80, message = "Names can be up to 80 characters.") String name,
            @Size(max = 60) String relation,
            @Min(value = 1900, message = "Enter a birth year after 1900.") @Max(value = 2100, message = "Enter a valid birth year.") Integer birthYear,
            @Size(max = 1000, message = "Notes can be up to 1000 characters.") String notes) {
    }

    public record FamilyView(
            UUID id,
            String name,
            String location,
            String timezone,
            Instant createdAt,
            List<DependantView> dependants,
            @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal weeklyGroceryBudget,
            String inviteCode) {
    }

    public record InviteInput(
            @NotBlank(message = "Enter their name.") @Size(max = 80) String name,
            @NotBlank(message = "Enter their email address.") @Email(message = "Enter a valid email address, like name@example.com.") @Size(max = 254) String email,
            @Size(max = 60) String relation,
            @NotNull(message = "Choose a role.") @Pattern(regexp = "contributor|observer", message = "Choose a role.") String role) {
    }

    public record CreateFamilyRequest(
            @NotBlank(message = "Give your family space a name.") @Size(max = 80) String name,
            @Size(max = 120) String location,
            @Size(max = 60) String myRelation,
            @Valid List<DependantInput> dependants,
            @Valid List<InviteInput> invites,
            Availability availability,
            @Size(max = 60) String timezone) {
    }

    /* ───────── members ───────── */

    public record AccessView(boolean schedule, boolean medical, boolean documents) {
    }

    public record StatusNoteView(String text, @JsonInclude(JsonInclude.Include.NON_NULL) Instant until, Instant updatedAt) {
    }

    public record MemberView(
            UUID id,
            String name,
            String relation,
            String role,
            String focus,
            String email,
            @JsonInclude(JsonInclude.Include.NON_NULL) String phone,
            @JsonInclude(JsonInclude.Include.NON_NULL) String photo,
            String status,
            List<String> skills,
            Availability availability,
            AccessView access,
            @JsonInclude(JsonInclude.Include.NON_NULL) StatusNoteView statusNote,
            Instant joinedAt) {
    }

    public record StatusRequest(@Size(max = 200) String text, Instant until) {
    }

    public record InviteLookup(FamilyView family, String inviterName, long memberCount, boolean alreadyMember) {
    }
}
