package com.hearth.family.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.InviteLookup;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Joining a family with its code. Knowing the code is not enough: the organiser must have invited this
 * account's email address, and (by default) the person must have confirmed that address, so nobody can
 * join by signing up with someone else's email.
 */
@Service
public class InviteService {

    private static final Pattern CODE = Pattern.compile("^HEARTH-[A-Z0-9]{3,8}$");

    private final Caller caller;
    private final FamilyRepository families;
    private final MemberRepository members;
    private final DependantRepository dependants;
    private final EventPublisher events;
    private final boolean requireVerifiedEmail;

    public InviteService(
            Caller caller,
            FamilyRepository families,
            MemberRepository members,
            DependantRepository dependants,
            EventPublisher events,
            @Value("${hearth.auth.require-verified-email-to-join:true}") boolean requireVerifiedEmail) {
        this.caller = caller;
        this.families = families;
        this.members = members;
        this.dependants = dependants;
        this.events = events;
        this.requireVerifiedEmail = requireVerifiedEmail;
    }

    @Transactional(readOnly = true)
    public InviteLookup lookup(String rawCode) {
        Account account = caller.account();
        Family family = findFamily(rawCode);
        String inviter = members.findByFamilyIdAndRole(family.getId(), Member.LEAD).stream().findFirst().map(Member::getName).orElse("Your family");
        long active = members.countByFamilyIdAndStatus(family.getId(), Member.ACTIVE);
        boolean alreadyMember = members.findByAccountId(account.getId()).map(m -> m.getFamilyId().equals(family.getId())).orElse(false);
        return new InviteLookup(view(family), inviter, active, alreadyMember);
    }

    @Transactional
    public FamilyView accept(String rawCode) {
        Account account = caller.account();
        Family family = findFamily(rawCode);
        Optional<Member> current = members.findByAccountId(account.getId());
        if (current.isPresent()) {
            if (current.get().getFamilyId().equals(family.getId())) {
                return view(family);
            }
            throw ApiException.conflict("You already belong to another family space. An account can be in one family at a time.");
        }
        Member invited = members.findByFamilyIdAndEmail(family.getId(), account.getEmail())
                .orElseThrow(() -> ApiException.forbidden("This family hasn’t invited " + account.getEmail() + " yet. Ask the organiser to invite this email address."));
        if (invited.getAccountId() != null) {
            throw ApiException.conflict("Someone has already joined with this invitation.");
        }
        if (requireVerifiedEmail && !account.isEmailVerified()) {
            throw ApiException.forbidden("Confirm your email address first: open the link we emailed you, then try again.");
        }
        invited.join(account.getId(), account.getName());
        if (account.getPhone() != null) {
            invited.setPhone(account.getPhone());
        }
        members.save(invited);
        events.publish(Topics.FAMILY, Events.of(EventTypes.MEMBER_JOINED, family.getId(), invited.getId())
                .audit("circle", "Joined the family", invited.getName())
                .notify("circle", invited.getName() + " joined the family.", "/family/" + invited.getId())
                .data("memberId", invited.getId())
                .build());
        return view(family);
    }

    private Family findFamily(String rawCode) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
        if (!CODE.matcher(code).matches()) {
            throw ApiException.unprocessable("Invitation codes look like HEARTH-7K3QXD.");
        }
        return families.findByInviteCode(code).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "We couldn’t find a family with that code. Check it with the person who invited you."));
    }

    private FamilyView view(Family family) {
        return Views.family(family, dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId()));
    }
}
