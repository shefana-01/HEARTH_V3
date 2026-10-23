package com.hearth.family.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.family.Availability;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.MemberView;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MemberServiceTest {

    private Caller caller;
    private MemberRepository members;
    private AccountRepository accounts;
    private EventPublisher events;
    private Mailer mailer;
    private ObjectMapper mapper;
    private MemberService service;

    private Account leadAccount;
    private Member leadMember;
    private Member contributorMember;
    private Family family;

    @BeforeEach
    void setUp() {
        caller = mock(Caller.class);
        members = mock(MemberRepository.class);
        accounts = mock(AccountRepository.class);
        events = mock(EventPublisher.class);
        mailer = mock(Mailer.class);
        mapper = new ObjectMapper();

        service = new MemberService(caller, members, accounts, events, mailer, mapper);

        leadAccount = new Account("lead@hearth.local", "hashed", "Lead User");
        family = new Family("Local Family", "Dhaka", "Asia/Dhaka", "HEARTH-123456");

        leadMember = new Member(family.getId(), "Lead User", "lead@hearth.local", "Mother", Member.LEAD, Member.ACTIVE, Availability.weekdays());
        contributorMember = new Member(family.getId(), "Child User", "child@hearth.local", "Son", Member.CONTRIBUTOR, Member.ACTIVE, Availability.weekdays());

        when(caller.membership()).thenReturn(new Caller.Membership(leadAccount, leadMember, family));
    }

    @Test
    @DisplayName("list() returns all family members in join order")
    void listReturnsAllMembers() {
        when(members.findByFamilyIdOrderByJoinedAtAsc(family.getId()))
                .thenReturn(List.of(leadMember, contributorMember));

        List<MemberView> views = service.list();

        assertThat(views).hasSize(2);
        assertThat(views.get(0).name()).isEqualTo("Lead User");
        assertThat(views.get(1).name()).isEqualTo("Child User");
    }

    @Test
    @DisplayName("get() returns a specific family member by id")
    void getReturnsMemberById() {
        when(members.findByIdAndFamilyId(contributorMember.getId(), family.getId())).thenReturn(Optional.of(contributorMember));

        MemberView view = service.get(contributorMember.getId());

        assertThat(view).isNotNull();
        assertThat(view.name()).isEqualTo("Child User");
        assertThat(view.role()).isEqualTo(Member.CONTRIBUTOR);
    }

    @Test
    @DisplayName("update() allows member to update their focus and phone")
    void updateProfileFields() throws Exception {
        when(members.findByIdAndFamilyId(leadMember.getId(), family.getId())).thenReturn(Optional.of(leadMember));
        when(members.save(any(Member.class))).thenAnswer(i -> i.getArgument(0));

        JsonNode json = mapper.readTree("{\"focus\": \"Studying for exams\", \"phone\": \"+8801700000000\"}");
        MemberView updated = service.update(leadMember.getId(), json);

        assertThat(updated.focus()).isEqualTo("Studying for exams");
        assertThat(leadMember.getPhone()).isEqualTo("+8801700000000");
        verify(members).save(leadMember);
    }

    @Test
    @DisplayName("update() allows organiser to change contributor role to observer")
    void updateRoleByLead() throws Exception {
        when(members.findByIdAndFamilyId(contributorMember.getId(), family.getId())).thenReturn(Optional.of(contributorMember));
        when(members.save(any(Member.class))).thenAnswer(i -> i.getArgument(0));

        JsonNode json = mapper.readTree("{\"role\": \"observer\"}");
        MemberView updated = service.update(contributorMember.getId(), json);

        assertThat(updated.role()).isEqualTo(Member.OBSERVER);
        verify(members).save(contributorMember);
    }

    @Test
    @DisplayName("remove() allows organiser to remove another member")
    void removeMemberByLead() {
        when(members.findByIdAndFamilyId(contributorMember.getId(), family.getId())).thenReturn(Optional.of(contributorMember));

        service.remove(contributorMember.getId());

        verify(members).delete(contributorMember);
    }

    @Test
    @DisplayName("remove() rejects removing the organiser with conflict")
    void removeOrganiserThrowsConflict() {
        when(members.findByIdAndFamilyId(leadMember.getId(), family.getId())).thenReturn(Optional.of(leadMember));

        assertThatThrownBy(() -> service.remove(leadMember.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("The organiser cannot be removed");
    }
}
