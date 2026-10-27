package com.hearth.family.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.family.Availability;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.InviteLookup;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InviteServiceTest {

    private Caller caller;
    private FamilyRepository families;
    private MemberRepository members;
    private DependantRepository dependants;
    private EventPublisher events;
    private InviteService service;

    private Account account;
    private Family family;
    private Member leadMember;
    private Member invitedMember;

    @BeforeEach
    void setUp() {
        caller = mock(Caller.class);
        families = mock(FamilyRepository.class);
        members = mock(MemberRepository.class);
        dependants = mock(DependantRepository.class);
        events = mock(EventPublisher.class);

        service = new InviteService(caller, families, members, dependants, events, true);

        account = new Account("newuser@hearth.local", "hashedpass", "New User");
        account.setEmailVerified(true);
        when(caller.account()).thenReturn(account);

        family = new Family("Smith Family", "London", "Europe/London", "HEARTH-ABC123");
        leadMember = new Member(family.getId(), "John Smith", "john@hearth.local", "Father", Member.LEAD, Member.ACTIVE, Availability.weekdays());
        invitedMember = new Member(family.getId(), "New User", "newuser@hearth.local", "Cousin", Member.CONTRIBUTOR, Member.INVITED, Availability.weekdays());

        when(families.findByInviteCode("HEARTH-ABC123")).thenReturn(Optional.of(family));
        when(dependants.findByFamilyIdOrderByCreatedAtAsc(family.getId())).thenReturn(List.of());
    }

    @Test
    @DisplayName("lookup() returns inviter name and family details for a valid code")
    void lookupValidInviteCode() {
        when(members.findByFamilyIdAndRole(family.getId(), Member.LEAD)).thenReturn(List.of(leadMember));
        when(members.countByFamilyIdAndStatus(family.getId(), Member.ACTIVE)).thenReturn(1L);
        when(members.findByAccountId(account.getId())).thenReturn(Optional.empty());

        InviteLookup lookup = service.lookup("HEARTH-ABC123");

        assertThat(lookup).isNotNull();
        assertThat(lookup.inviterName()).isEqualTo("John Smith");
        assertThat(lookup.memberCount()).isEqualTo(1L);
        assertThat(lookup.alreadyMember()).isFalse();
    }

    @Test
    @DisplayName("lookup() rejects malformed invite code with 422")
    void lookupInvalidCodeFormatThrowsUnprocessable() {
        assertThatThrownBy(() -> service.lookup("INVALID"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invitation codes look like HEARTH-7K3QXD");
    }

    @Test
    @DisplayName("accept() links account to invited member and emits domain event")
    void acceptInviteSuccess() {
        when(members.findByAccountId(account.getId())).thenReturn(Optional.empty());
        when(members.findByFamilyIdAndEmail(family.getId(), account.getEmail())).thenReturn(Optional.of(invitedMember));
        when(members.save(any(Member.class))).thenAnswer(i -> i.getArgument(0));

        FamilyView result = service.accept("HEARTH-ABC123");

        assertThat(result).isNotNull();
        assertThat(invitedMember.getAccountId()).isEqualTo(account.getId());
        assertThat(invitedMember.getStatus()).isEqualTo(Member.ACTIVE);
        verify(members).save(invitedMember);
        verify(events).publish(any(), any());
    }

    @Test
    @DisplayName("accept() rejects user who already belongs to another family space")
    void acceptRejectsIfAlreadyInAnotherFamily() {
        UUID otherFamilyId = UUID.randomUUID();
        Member otherMembership = new Member(otherFamilyId, "New User", "newuser@hearth.local", "Friend", Member.CONTRIBUTOR, Member.ACTIVE, Availability.weekdays());
        when(members.findByAccountId(account.getId())).thenReturn(Optional.of(otherMembership));

        assertThatThrownBy(() -> service.accept("HEARTH-ABC123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("You already belong to another family space");
    }

    @Test
    @DisplayName("accept() requires email to be verified before joining")
    void acceptRequiresVerifiedEmail() {
        account.setEmailVerified(false);
        when(members.findByAccountId(account.getId())).thenReturn(Optional.empty());
        when(members.findByFamilyIdAndEmail(family.getId(), account.getEmail())).thenReturn(Optional.of(invitedMember));

        assertThatThrownBy(() -> service.accept("HEARTH-ABC123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Confirm your email address first");
    }
}
