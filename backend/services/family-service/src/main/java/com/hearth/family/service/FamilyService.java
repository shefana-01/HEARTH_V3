package com.hearth.family.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.text.Formats;
import com.hearth.common.web.Patch;
import com.hearth.family.dto.FamilyDtos.CreateFamilyRequest;
import com.hearth.family.dto.FamilyDtos.DependantInput;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.InviteInput;
import com.hearth.family.email.Emails;
import com.hearth.family.entity.Account;
import com.hearth.family.entity.Family;
import com.hearth.family.entity.Member;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import java.security.SecureRandom;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FamilyService {

    /** No 0/O or 1/I/L, so a code is easy to read out loud. About 890 million combinations. */
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;

    private final CurrentAccount currentAccount;
    private final FamilyDirectory directory;
    private final FamilyRepository families;
    private final DependantRepository dependants;
    private final MemberRepository members;
    private final EventPublisher events;
    private final Emails emails;
    private final SecureRandom random = new SecureRandom();

    public FamilyService(
            CurrentAccount currentAccount,
            FamilyDirectory directory,
            FamilyRepository families,
            DependantRepository dependants,
            MemberRepository members,
            EventPublisher events,
            Emails emails) {
        this.emails = emails;
        this.currentAccount = currentAccount;
        this.directory = directory;
        this.families = families;
        this.dependants = dependants;
        this.members = members;
        this.events = events;
    }

    /** The caller's family, or empty if they have not set one up or joined one yet. */
    @Transactional(readOnly = true)
    public Optional<FamilyView> current() {
        Account account = currentAccount.require();
        return members.findByAccountId(account.getId()).flatMap(member -> families.findById(member.getFamilyId())).map(this::view);
    }

    @Transactional
    public FamilyView create(CreateFamilyRequest request) {
        Account account = currentAccount.require();
        if (members.findByAccountId(account.getId()).isPresent()) {
            throw ApiException.conflict("You already belong to a family.");
        }
        Instant now = Instant.now();

        Family family = new Family();
        family.setId(UUID.randomUUID());
        family.setName(request.name().trim());
        family.setLocation(Formats.trim(request.location()));
        family.setTimezone(validZone(request.timezone()));
        family.setInviteCode(newInviteCode());
        family.setCreatedAt(now);
        families.save(family);

        // Rows left empty in the form are skipped. A millisecond apart, so the list keeps the order they were entered in.
        int position = 0;
        for (DependantInput input : request.dependants() == null ? List.<DependantInput>of() : request.dependants()) {
            if (!Formats.trim(input.name()).isEmpty()) {
                dependants.save(DependantService.build(family.getId(), input, now.plusMillis(position++)));
            }
        }

        Member lead = new Member();
        lead.setId(UUID.randomUUID());
        lead.setFamilyId(family.getId());
        lead.setAccountId(account.getId());
        lead.setName(account.getName());
        lead.setRelation(Formats.trim(request.myRelation()));
        lead.setRole(Member.ROLE_LEAD);
        lead.setFocus("");
        lead.setEmail(account.getEmail());
        lead.setPhone(account.getPhone());
        lead.setPhoto(account.getPhoto());
        lead.setStatus(Member.STATUS_ACTIVE);
        lead.setAvailability(request.availability() == null ? Member.everyDay() : AvailabilityRules.clean(request.availability()));
        lead.setAccessSchedule(true);
        lead.setAccessMedical(true);
        lead.setAccessDocuments(true);
        lead.setJoinedAt(now);
        members.save(lead);

        Set<String> seen = new HashSet<>();
        seen.add(account.getEmail().toLowerCase());
        for (InviteInput invite : request.invites() == null ? List.<InviteInput>of() : request.invites()) {
            if (seen.add(invite.email().trim().toLowerCase())) {
                members.save(invitedMember(family.getId(), invite));
                emails.invitation(invite.email().trim(), invite.name().trim(), account.getName(), family.getName(), family.getInviteCode());
            }
        }

        events.publish(Topics.FAMILY, Events.of("family.created", family.getId(), lead.getId())
                .audit("circle", "Created the family space", family.getName())
                .build());
        return view(family);
    }

    @Transactional
    public FamilyView update(JsonNode body) {
        FamilyContext context = directory.context();
        context.requireLead();
        Family family = families.findById(context.familyId()).orElseThrow(() -> ApiException.notFound("Your family"));

        Patch patch = Patch.of(body);
        patch.requiredText("name", 80, family::setName);
        patch.text("location", 120, value -> family.setLocation(value == null ? "" : value));
        patch.text("timezone", 60, value -> family.setTimezone(validZone(value)));
        if (patch.has("weeklyGroceryBudget")) {
            family.setWeeklyGroceryBudget(validBudget(patch.node("weeklyGroceryBudget")));
        }
        families.save(family);

        events.publish(Topics.FAMILY, Events.of("family.updated", context)
                .audit("circle", "Updated family details", family.getName())
                .build());
        return view(family);
    }

    static Member invitedMember(UUID familyId, InviteInput invite) {
        Member member = new Member();
        member.setId(UUID.randomUUID());
        member.setFamilyId(familyId);
        member.setName(invite.name().trim());
        member.setRelation(Formats.trim(invite.relation()));
        member.setRole(invite.role());
        member.setEmail(invite.email().trim());
        member.setStatus(Member.STATUS_INVITED);
        member.setAvailability(Member.everyDay());
        member.setAccessSchedule(true);
        member.setJoinedAt(Instant.now());
        return member;
    }

    private String newInviteCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder code = new StringBuilder("HEARTH-");
            for (int i = 0; i < CODE_LENGTH; i++) {
                code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            if (!families.existsByInviteCode(code.toString())) {
                return code.toString();
            }
        }
        throw new IllegalStateException("Could not generate a unique invitation code");
    }

    private static String validZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return "UTC";
        }
        try {
            return ZoneId.of(timezone.trim()).getId();
        } catch (DateTimeException ex) {
            throw ApiException.badRequest("That time zone is not recognised.");
        }
    }

    /** Null clears the budget; otherwise it must be a number of zero or more. */
    private static Double validBudget(JsonNode node) {
        if (node.isNull()) {
            return null;
        }
        if (!node.isNumber() || !Double.isFinite(node.asDouble()) || node.asDouble() < 0) {
            throw ApiException.unprocessable("Enter a weekly budget of zero or more.");
        }
        return node.asDouble();
    }

    private FamilyView view(Family family) {
        return Views.family(family, dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId()));
    }
}
