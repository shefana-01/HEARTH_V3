package com.hearth.family.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Topics;
import com.hearth.common.family.Availability;
import com.hearth.common.http.ServiceClient;
import com.hearth.family.application.Caller.Membership;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Dependant;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.DependantInput;
import com.hearth.family.dto.FamilyDtos.DependantView;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

class FamilyServiceTest {

    private Caller caller;
    private FamilyRepository families;
    private MemberRepository members;
    private DependantRepository dependants;
    private EventPublisher events;
    private Mailer mailer;
    private ServiceClient services;
    private FamilyService service;

    private Account account;
    private Member member;
    private Family family;

    @BeforeEach
    void setUp() {
        caller = mock(Caller.class);
        families = mock(FamilyRepository.class);
        members = mock(MemberRepository.class);
        dependants = mock(DependantRepository.class);
        events = mock(EventPublisher.class);
        mailer = mock(Mailer.class);
        services = mock(ServiceClient.class);

        service = new FamilyService(caller, families, members, dependants, events, mailer, services, "http://localhost:8083");

        account = new Account("suprio@example.com", "hashed_pwd", "Suprio Chakraborty");
        family = new Family("Chakraborty Family", "Dhaka", "UTC", "INVITE-12345");
        member = new Member(family.getId(), "Suprio Chakraborty", "suprio@example.com", "Brother", Member.LEAD, Member.ACTIVE, Availability.weekdays());

        Membership membership = new Membership(account, member, family);
        when(caller.membership()).thenReturn(membership);
    }

    @Test
    @DisplayName("addDependant saves dependant and publishes family event")
    void addDependantSavesAndPublishes() {
        DependantInput input = new DependantInput("Grandmother Maya", "Grandmother", 1950, "Needs mobility assistance");

        when(dependants.save(any(Dependant.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DependantView view = service.addDependant(input);

        assertThat(view.name()).isEqualTo("Grandmother Maya");
        assertThat(view.relation()).isEqualTo("Grandmother");
        assertThat(view.birthYear()).isEqualTo(1950);

        verify(dependants).save(any(Dependant.class));
        verify(events).publish(eq(Topics.FAMILY), any(DomainEvent.class));
    }

    @Test
    @DisplayName("updateDependant updates fields and publishes family event")
    void updateDependantModifiesFields() {
        Dependant existing = new Dependant(family.getId());
        existing.setName("Maya");
        existing.setRelation("Grandmother");

        when(dependants.findByIdAndFamilyId(existing.getId(), family.getId())).thenReturn(Optional.of(existing));
        when(dependants.save(any(Dependant.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DependantInput input = new DependantInput("Grandmother Maya Updated", "Paternal Grandmother", 1949, "Diabetic diet");
        DependantView view = service.updateDependant(existing.getId(), input);

        assertThat(view.name()).isEqualTo("Grandmother Maya Updated");
        assertThat(view.relation()).isEqualTo("Paternal Grandmother");
        assertThat(view.birthYear()).isEqualTo(1949);

        verify(dependants).save(existing);
        verify(events).publish(eq(Topics.FAMILY), any(DomainEvent.class));
    }

    @Test
    @DisplayName("removeDependant deletes dependant when no upcoming appointments exist")
    void removeDependantDeletesCleanly() {
        Dependant existing = new Dependant(family.getId());
        existing.setName("Maya");

        when(dependants.findByIdAndFamilyId(existing.getId(), family.getId())).thenReturn(Optional.of(existing));
        when(services.get(anyString(), any(ParameterizedTypeReference.class))).thenReturn(List.of());

        service.removeDependant(existing.getId());

        verify(dependants).delete(existing);
        verify(events).publish(eq(Topics.FAMILY), any(DomainEvent.class));
    }

    @Test
    @DisplayName("removeDependant throws conflict when dependant has upcoming appointments")
    void removeDependantRejectsIfAppointmentsUpcoming() {
        Dependant existing = new Dependant(family.getId());
        existing.setName("Maya");

        when(dependants.findByIdAndFamilyId(existing.getId(), family.getId())).thenReturn(Optional.of(existing));

        Map<String, Object> upcomingApp = Map.of(
                "forId", existing.getId().toString(),
                "start", "2099-01-01T10:00:00Z");

        when(services.get(anyString(), any(ParameterizedTypeReference.class))).thenReturn(List.of(upcomingApp));

        assertThatThrownBy(() -> service.removeDependant(existing.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("still has upcoming appointments");
    }

    @Test
    @DisplayName("addDependant throws forbidden if caller is an observer")
    void addDependantRejectsObserver() {
        Member observerMember = new Member(family.getId(), "Observer User", "obs@example.com", "Friend", Member.OBSERVER, Member.ACTIVE, Availability.weekdays());
        when(caller.membership()).thenReturn(new Membership(account, observerMember, family));

        DependantInput input = new DependantInput("Test", "Relation", 2000, null);

        assertThatThrownBy(() -> service.addDependant(input))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Observers can view the plan but cannot change it.");
    }
}
