package com.hearth.family.application;

import com.hearth.family.domain.Account;
import com.hearth.family.domain.Dependant;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.AccessView;
import com.hearth.family.dto.FamilyDtos.AccountView;
import com.hearth.family.dto.FamilyDtos.DependantView;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.MemberView;
import com.hearth.family.dto.FamilyDtos.StatusNoteView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Turns stored records into the shapes the browser expects. */
final class Views {

    private Views() {
    }

    static AccountView account(Account account, Member member) {
        return new AccountView(
                account.getId(),
                member == null ? null : member.getId(),
                account.getName(),
                account.getEmail(),
                account.getPhone(),
                account.getAbout(),
                account.getPhoto(),
                account.isEmailVerified(),
                account.isWhatsappAlerts());
    }

    static FamilyView family(Family family, List<Dependant> dependants) {
        return new FamilyView(
                family.getId(),
                family.getName(),
                family.getLocation(),
                family.getTimezone(),
                family.getCreatedAt(),
                dependants.stream().map(Views::dependant).toList(),
                family.getWeeklyGroceryBudget(),
                family.getInviteCode());
    }

    static DependantView dependant(Dependant dependant) {
        return new DependantView(dependant.getId(), dependant.getName(), dependant.getRelation(), dependant.getBirthYear(), dependant.getNotes());
    }

    /**
     * @param photos profile pictures by account id (a member's picture is their account's)
     */
    static MemberView member(Member member, Map<UUID, String> photos) {
        StatusNoteView status = null;
        // A status line with an end time disappears by itself once that time has passed.
        if (member.getStatusText() != null && (member.getStatusUntil() == null || member.getStatusUntil().isAfter(Instant.now()))) {
            status = new StatusNoteView(member.getStatusText(), member.getStatusUntil(), member.getStatusUpdatedAt());
        }
        return new MemberView(
                member.getId(),
                member.getName(),
                member.getRelation(),
                member.getRole(),
                member.getFocus(),
                member.getEmail(),
                member.getPhone(),
                member.getAccountId() == null ? null : photos.get(member.getAccountId()),
                member.getStatus(),
                List.copyOf(member.getSkills()),
                member.getAvailability(),
                new AccessView(member.isAccessSchedule(), member.canSeeMedical(), member.canSeeDocuments()),
                status,
                member.getJoinedAt());
    }
}
