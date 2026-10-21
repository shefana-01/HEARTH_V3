package com.hearth.family.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.Availability;
import com.hearth.common.web.Patch;
import com.hearth.family.application.Caller.Membership;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.InviteInput;
import com.hearth.family.dto.FamilyDtos.MemberView;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The people in a family. Everyone in the family can see everyone; the organiser invites, removes and
 * decides roles and what each person may see; everybody can change their own details.
 */
@Service
public class MemberService {

    /** Kinds of help a member can offer (used by the suitability score). */
    static final Set<String> SKILLS = Set.of("driving", "medication", "errands", "meals", "household", "childcare", "mobility", "companionship", "clinical");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 ()-]{7,20}$");

    private final Caller caller;
    private final MemberRepository members;
    private final AccountRepository accounts;
    private final EventPublisher events;
    private final Mailer mailer;
    private final ObjectMapper mapper;

    public MemberService(Caller caller, MemberRepository members, AccountRepository accounts, EventPublisher events, Mailer mailer, ObjectMapper mapper) {
        this.caller = caller;
        this.members = members;
        this.accounts = accounts;
        this.events = events;
        this.mailer = mailer;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<MemberView> list() {
        Membership me = caller.membership();
        List<Member> all = members.findByFamilyIdOrderByJoinedAtAsc(me.family().getId());
        Map<UUID, String> photos = photos(all);
        return all.stream().map(member -> Views.member(member, photos)).toList();
    }

    @Transactional(readOnly = true)
    public MemberView get(UUID id) {
        Member member = find(caller.membership(), id);
        return Views.member(member, photos(List.of(member)));
    }

    /** The organiser adds someone by email; they get an email with the family code and join with their own account. */
    @Transactional
    public MemberView invite(InviteInput input) {
        Membership me = caller.membership();
        me.requireLead();
        if (members.findByFamilyIdAndEmail(me.family().getId(), input.email().trim()).isPresent()) {
            throw ApiException.conflict("Someone with this email is already in your family.");
        }
        Member member = newInvitedMember(me.family().getId(), input);
        members.save(member);
        mailer.invitation(member.getEmail(), member.getName(), me.member().getName(), me.family().getName(), me.family().getInviteCode());
        events.publish(Topics.FAMILY, Events.of(EventTypes.MEMBER_INVITED, me.context())
                .audit("circle", "Invited a member", member.getName(), null, member.getRelation().isBlank() ? member.getRole() : member.getRelation())
                .notify("circle", member.getName() + " was invited to the family.", "/family/" + member.getId())
                .data("memberId", member.getId())
                .build());
        return Views.member(member, Map.of());
    }

    /**
     * Anyone can change their own focus, relation, phone, skills and availability; the organiser can change
     * anyone's. Only the organiser changes roles and access, and never their own (a family always keeps
     * its organiser).
     */
    @Transactional
    public MemberView update(UUID id, JsonNode body) {
        Membership me = caller.membership();
        Member member = find(me, id);
        boolean self = member.getId().equals(me.member().getId());
        boolean lead = me.member().isLead();
        if (!self && !lead) {
            throw ApiException.forbidden("You can only change your own details.");
        }
        Patch patch = Patch.of(body);

        patch.text("focus", 200, focus -> member.setFocus(focus == null ? "" : focus));
        patch.text("relation", 60, relation -> member.setRelation(relation == null ? "" : relation));
        patch.text("phone", 30, phone -> {
            String value = phone == null || phone.isBlank() ? null : phone;
            if (value != null && !PHONE.matcher(value).matches()) {
                throw ApiException.unprocessable("Enter a valid phone number.");
            }
            member.setPhone(value);
        });
        if (patch.has("skills") && !patch.node("skills").isNull()) {
            member.setSkills(skills(patch.node("skills")));
        }
        if (patch.has("availability") && !patch.node("availability").isNull()) {
            member.setAvailability(AvailabilityRules.clean(read(patch.node("availability"), Availability.class)));
        }
        if (patch.has("role") && !patch.node("role").isNull() && !patch.node("role").asText().equals(member.getRole())) {
            requireManage(me, member);
            String role = patch.node("role").asText();
            if (!Member.CONTRIBUTOR.equals(role) && !Member.OBSERVER.equals(role)) {
                throw ApiException.unprocessable("Choose a role.");
            }
            member.setRole(role);
        }
        if (patch.has("access") && !patch.node("access").isNull()) {
            JsonNode access = patch.node("access");
            boolean changes = access.has("schedule") && access.get("schedule").asBoolean() != member.isAccessSchedule()
                    || access.has("medical") && access.get("medical").asBoolean() != member.isAccessMedical()
                    || access.has("documents") && access.get("documents").asBoolean() != member.isAccessDocuments();
            if (changes) {
                requireManage(me, member);
                if (access.has("schedule")) {
                    member.setAccessSchedule(access.get("schedule").asBoolean());
                }
                if (access.has("medical")) {
                    member.setAccessMedical(access.get("medical").asBoolean());
                }
                if (access.has("documents")) {
                    member.setAccessDocuments(access.get("documents").asBoolean());
                }
            }
        }
        members.save(member);
        events.publish(Topics.FAMILY, Events.of(EventTypes.MEMBER_UPDATED, me.context())
                .audit("circle", "Updated a member profile", member.getName())
                .data("memberId", member.getId())
                .build());
        return Views.member(member, photos(List.of(member)));
    }

    /**
     * The organiser removes someone. Shared tasks they had go back to "needs someone"; their private tasks,
     * events, visits and health notes leave with them (other services do that on the event).
     */
    @Transactional
    public void remove(UUID id) {
        Membership me = caller.membership();
        me.requireLead();
        Member member = find(me, id);
        if (member.isLead()) {
            throw ApiException.conflict("The organiser cannot be removed.");
        }
        members.delete(member);
        events.publish(Topics.FAMILY, Events.of(EventTypes.MEMBER_REMOVED, me.context())
                .audit("circle", "Removed a member", member.getName())
                .data("memberId", member.getId())
                .build());
    }

    /** The signed-in person's status line ("In class until 2"). Empty text clears it. The family chat shows a new one. */
    @Transactional
    public MemberView setStatus(UUID id, String text, Instant until) {
        Membership me = caller.membership();
        if (!id.equals(me.member().getId())) {
            throw ApiException.forbidden("You can only set your own status.");
        }
        Member member = me.member();
        String value = text == null ? "" : text.trim();
        Events event = Events.of(EventTypes.MEMBER_STATUS_CHANGED, me.context()).data("memberId", member.getId());
        if (value.isEmpty()) {
            member.setStatusNote(null, null);
        } else {
            if (until != null && !until.isAfter(Instant.now())) {
                throw ApiException.unprocessable("Choose a time in the future, or leave it open.");
            }
            String shown = value.length() > 80 ? value.substring(0, 80) : value;
            member.setStatusNote(shown, until);
            event.statusMessage(member.getId(), shown);
        }
        members.save(member);
        events.publish(Topics.FAMILY, event.build());
        return Views.member(member, photos(List.of(member)));
    }

    @Transactional(readOnly = true)
    public Availability availability(UUID id) {
        return find(caller.membership(), id).getAvailability();
    }

    /** Your own weekly availability; the organiser can set anyone's. */
    @Transactional
    public Availability saveAvailability(UUID id, Availability input) {
        Membership me = caller.membership();
        Member member = find(me, id);
        if (!member.getId().equals(me.member().getId()) && !me.member().isLead()) {
            throw ApiException.forbidden("You can only change your own availability.");
        }
        Availability availability = AvailabilityRules.clean(input);
        member.setAvailability(availability);
        members.save(member);
        events.publish(Topics.FAMILY, Events.of(EventTypes.AVAILABILITY_UPDATED, me.context())
                .audit("schedule", "Updated weekly availability", member.getName(), null, availability.windowsOrEmpty().size() + " time window(s)")
                .data("memberId", member.getId())
                .build());
        return availability;
    }

    static Member newInvitedMember(UUID familyId, InviteInput input) {
        Member member = new Member(familyId, input.name().trim(), input.email().trim(), input.relation() == null ? "" : input.relation().trim(), input.role(), Member.INVITED, AvailabilityRules.everyDay());
        member.setAccessSchedule(true);
        return member;
    }

    private Member find(Membership me, UUID id) {
        return members.findByIdAndFamilyId(id, me.family().getId()).orElseThrow(() -> ApiException.notFound("That family member"));
    }

    private static void requireManage(Membership me, Member target) {
        if (!me.member().isLead()) {
            throw ApiException.forbidden("Only the organiser can change roles and access.");
        }
        if (target.isLead()) {
            throw ApiException.conflict("The organiser’s role and access cannot be changed.");
        }
    }

    private List<String> skills(JsonNode node) {
        if (!node.isArray()) {
            throw ApiException.unprocessable("Choose from the listed skills.");
        }
        Set<String> chosen = new LinkedHashSet<>();
        for (JsonNode item : node) {
            String skill = item.asText();
            if (!SKILLS.contains(skill)) {
                throw ApiException.unprocessable("Choose from the listed skills.");
            }
            chosen.add(skill);
        }
        return new ArrayList<>(chosen);
    }

    private <T> T read(JsonNode node, Class<T> type) {
        try {
            return mapper.treeToValue(node, type);
        } catch (Exception ex) {
            throw ApiException.badRequest("The request could not be read. Check the values and try again.");
        }
    }

    private Map<UUID, String> photos(List<Member> list) {
        List<UUID> ids = list.stream().map(Member::getAccountId).filter(Objects::nonNull).toList();
        Map<UUID, String> photos = new HashMap<>();
        for (Account account : accounts.findAllById(ids)) {
            if (account.getPhoto() != null) {
                photos.put(account.getId(), account.getPhoto());
            }
        }
        return photos;
    }
}
