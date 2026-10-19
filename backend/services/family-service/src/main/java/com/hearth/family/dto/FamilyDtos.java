package com.hearth.family.dto;
import java.util.List;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import com.hearth.common.family.Availability;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;

import com.hearth.family.domain.MemberRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

public class FamilyDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisterRequest {
        @Email @NotBlank
        private String email;
        @NotBlank
        private String password;
        @NotBlank
        private String firstName;
        @NotBlank
        private String lastName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        @Email @NotBlank
        private String email;
        @NotBlank
        private String password;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuthResponse {
        private String token;
        private UUID userId;
        private String email;
        private String firstName;
        private String lastName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateFamilyRequest {
        @NotBlank
        private String name;
        private UUID adminUserId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FamilyResponse {
        private UUID id;
        private String name;
        private UUID createdBy;
        private Instant createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InviteMemberRequest {
        @Email @NotBlank
        private String email;
        private MemberRole role;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberResponse {
        private UUID id;
        private UUID familyId;
        private UUID userId;
        private String role;
        private String status;
        private Instant joinedAt;
    }

    public record AccountView(
            UUID id,
            UUID memberId,
            String name,
            String email,
            @JsonInclude(JsonInclude.Include.NON_NULL) String phone,
            String about,
            @JsonInclude(JsonInclude.Include.NON_NULL) String photo,
            boolean whatsappAlerts,
            boolean emailVerified) {
    }

    public record SessionView(AccountView account, boolean hasFamily, @JsonProperty("isSample") boolean sample) {
    }

    public record DependantView(UUID id, String name, String relation, @JsonInclude(JsonInclude.Include.NON_NULL) Integer birthYear, String notes) {
    }

    public record FamilyView(
            UUID id,
            String name,
            String location,
            String timezone,
            Instant createdAt,
            List<DependantView> dependants,
            @JsonInclude(JsonInclude.Include.NON_NULL) Double weeklyGroceryBudget,
            String inviteCode) {
    }

    public record AccessView(boolean schedule, boolean medical, boolean documents) {
    }

    /** The "what I'm up to" line. {@code until} is absent when it lasts until it is changed. */
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

    /**
     * A blank name is not rejected here: when a family is created, rows left empty are skipped,
     * while adding or editing one person answers "Enter their name." (see DependantService).
     */
    public record DependantInput(
            @Size(max = 80, message = "Names can be at most 80 characters.") String name,
            @Size(max = 60, message = "Relationships can be at most 60 characters.") String relation,
            Integer birthYear,
            @Size(max = 2000, message = "Notes can be at most 2000 characters.") String notes) {
    }

    /** An empty text clears the status line. */
    public record StatusInput(String text, Instant until) {
    }

    public record InviteInput(
            @NotBlank(message = "Enter a name.") @Size(max = 80) String name,
            @NotBlank(message = "Enter an email address.") @Email(message = "Enter a valid email address.") @Size(max = 255) String email,
            @Size(max = 60) String relation,
            @NotNull @Pattern(regexp = "contributor|observer", message = "Choose a role.") String role) {
    }

    public record CreateFamilyRequest(
            @NotBlank(message = "Enter a family name.") @Size(max = 80) String name,
            @Size(max = 120) String location,
            @Size(max = 60) String myRelation,
            @Size(max = 20, message = "Add up to 20 people the family looks after.") @Valid List<DependantInput> dependants,
            @Valid List<InviteInput> invites,
            Availability availability,
            @Size(max = 60) String timezone) {
    }

    public record InviteLookup(FamilyView family, String inviterName, long memberCount, boolean alreadyMember) {
    }
}
