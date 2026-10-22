package com.hearth.family.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.web.Patch;
import com.hearth.family.application.Caller.Membership;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Dependant;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.CreateFamilyRequest;
import com.hearth.family.dto.FamilyDtos.DependantInput;
import com.hearth.family.dto.FamilyDtos.DependantView;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.InviteInput;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import com.hearth.family.security.SecureTokens;
import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The family space: creating it, its details, and the people it looks after. */
@Service
public class FamilyService {

    private final Caller caller;
    private final FamilyRepository families;
    private final MemberRepository members;
    private final DependantRepository dependants;
    private final EventPublisher events;
    private final Mailer mailer;
    private final ServiceClient services;
    private final String careServiceUrl;

    public FamilyService(
            Caller caller,
            FamilyRepository families,
            MemberRepository members,
            DependantRepository dependants,
            EventPublisher events,
            Mailer mailer,
            ServiceClient services,
            @Value("${hearth.services.care}") String careServiceUrl) {
        this.caller = caller;
        this.families = families;
        this.members = members;
        this.dependants = dependants;
        this.events = events;
        this.mailer = mailer;
        this.services = services;
        this.careServiceUrl = careServiceUrl;
    }

    /** The caller's family, or null before they have one (the browser then shows the set-up screens). */
    @Transactional(readOnly = true)
    public FamilyView get() {
        Account account = caller.account();
        return members.findByAccountId(account.getId())
                .flatMap(member -> families.findById(member.getFamilyId()))
                .map(family -> Views.family(family, dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId())))
                .orElse(null);
    }

    /** Creates the family with the caller as its organiser, plus anyone they want to invite or look after. */
    @Transactional
    public FamilyView create(CreateFamilyRequest request) {
        Account account = caller.account();
        if (members.findByAccountId(account.getId()).isPresent()) {
            throw ApiException.conflict("You already belong to a family space.");
        }
        Family family = new Family(request.name().trim(), trim(request.location()), zone(request.timezone()), newInviteCode());
        families.save(family);

        Member lead = new Member(family.getId(), account.getName(), account.getEmail(), trim(request.myRelation()), Member.LEAD, Member.ACTIVE, AvailabilityRules.clean(request.availability()));
        lead.setAccountId(account.getId());
        lead.setPhone(account.getPhone());
        lead.setAccessMedical(true);
        lead.setAccessDocuments(true);
        members.save(lead);

        for (DependantInput input : request.dependants() == null ? List.<DependantInput>of() : request.dependants()) {
            if (input != null && input.name() != null && !input.name().isBlank()) {
                dependants.save(apply(new Dependant(family.getId()), input));
            }
        }

        Set<String> invited = new HashSet<>();
        invited.add(account.getEmail().toLowerCase());
        for (InviteInput invite : request.invites() == null ? List.<InviteInput>of() : request.invites()) {
            if (invite != null && invited.add(invite.email().trim().toLowerCase())) {
                Member member = MemberService.newInvitedMember(family.getId(), invite);
                members.save(member);
                mailer.invitation(member.getEmail(), member.getName(), lead.getName(), family.getName(), family.getInviteCode());
            }
        }

        events.publish(Topics.FAMILY, Events.of(EventTypes.FAMILY_CREATED, family.getId(), lead.getId())
                .audit("circle", "Created the family space", family.getName())
                .build());
        return Views.family(family, dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId()));
    }

    /** Name, place and weekly grocery budget. The organiser only. */
    @Transactional
    public FamilyView update(JsonNode body) {
        Membership me = caller.membership();
        me.requireLead();
        Family family = me.family();
        Patch patch = Patch.of(body);
        patch.requiredText("name", 80, family::setName);
        patch.text("location", 120, location -> family.setLocation(location == null ? "" : location));
        if (patch.has("weeklyGroceryBudget")) {
            JsonNode value = patch.node("weeklyGroceryBudget");
            if (value == null || value.isNull()) {
                family.setWeeklyGroceryBudget(null);
            } else if (!value.isNumber() || value.decimalValue().signum() < 0 || value.decimalValue().compareTo(new BigDecimal("100000000")) > 0) {
                throw ApiException.unprocessable("Enter a budget of 0 or more.");
            } else {
                family.setWeeklyGroceryBudget(value.decimalValue());
            }
        }
        families.save(family);
        events.publish(Topics.FAMILY, Events.of(EventTypes.FAMILY_UPDATED, me.context()).audit("circle", "Updated family details", family.getName()).build());
        return Views.family(family, dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId()));
    }

    /* ───────── people the family looks after ───────── */

    @Transactional
    public DependantView addDependant(DependantInput input) {
        Membership me = caller.membership();
        me.requireContributor();
        Dependant dependant = apply(new Dependant(me.family().getId()), input);
        dependants.save(dependant);
        events.publish(Topics.FAMILY, Events.of(EventTypes.DEPENDANT_ADDED, me.context())
                .audit("circle", "Added someone the family looks after", dependant.getName(), null, blankToNull(dependant.getRelation()))
                .data("dependantId", dependant.getId())
                .build());
        return Views.dependant(dependant);
    }

    @Transactional
    public DependantView updateDependant(UUID id, DependantInput input) {
        Membership me = caller.membership();
        me.requireContributor();
        Dependant dependant = findDependant(me, id);
        apply(dependant, input);
        dependants.save(dependant);
        events.publish(Topics.FAMILY, Events.of(EventTypes.DEPENDANT_UPDATED, me.context())
                .audit("circle", "Updated someone the family looks after", dependant.getName())
                .data("dependantId", dependant.getId())
                .build());
        return Views.dependant(dependant);
    }

    /**
     * Their health notes go with them; tasks, documents and the shopping list keep their entries but lose
     * the link (the other services do that when they see the event). Not while they have upcoming visits.
     */
    @Transactional
    public void removeDependant(UUID id) {
        Membership me = caller.membership();
        me.requireContributor();
        Dependant dependant = findDependant(me, id);
        if (hasUpcomingAppointments(dependant.getId())) {
            throw ApiException.conflict(dependant.getName() + " still has upcoming appointments. Remove or move those first.");
        }
        dependants.delete(dependant);
        events.publish(Topics.FAMILY, Events.of(EventTypes.DEPENDANT_REMOVED, me.context())
                .audit("circle", "Removed someone the family looks after", dependant.getName())
                .data("dependantId", dependant.getId())
                .build());
    }

    private boolean hasUpcomingAppointments(UUID personId) {
        List<Map<String, Object>> appointments = services.get(careServiceUrl + "/api/v1/internal/appointments", new ParameterizedTypeReference<List<Map<String, Object>>>() {
        });
        Instant now = Instant.now();
        return appointments != null && appointments.stream().anyMatch(a -> personId.toString().equals(String.valueOf(a.get("forId"))) && a.get("start") != null && Instant.parse(a.get("start").toString()).isAfter(now));
    }

    private Dependant findDependant(Membership me, UUID id) {
        return dependants.findByIdAndFamilyId(id, me.family().getId()).orElseThrow(() -> ApiException.notFound("That person"));
    }

    private static Dependant apply(Dependant dependant, DependantInput input) {
        dependant.setName(input.name().trim());
        dependant.setRelation(trim(input.relation()));
        dependant.setBirthYear(input.birthYear());
        dependant.setNotes(trim(input.notes()));
        return dependant;
    }

    private String newInviteCode() {
        String code;
        do {
            code = SecureTokens.newInviteCode();
        } while (families.existsByInviteCode(code));
        return code;
    }

    /** The browser's time zone, if it is a real one. */
    private static String zone(String timezone) {
        try {
            return timezone == null || timezone.isBlank() ? "UTC" : ZoneId.of(timezone.trim()).getId();
        } catch (DateTimeException ex) {
            return "UTC";
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
