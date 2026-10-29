package com.hearth.family.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.Availability;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.AccountView;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AccountServiceTest {

    private AccountRepository accounts;
    private MemberRepository members;
    private AuthService auth;
    private ObjectMapper mapper;
    private AccountService service;

    private UUID accountId;
    private UUID familyId;
    private Account account;
    private Member member;

    @BeforeEach
    void setUp() {
        accounts = mock(AccountRepository.class);
        members = mock(MemberRepository.class);
        auth = mock(AuthService.class);
        mapper = new ObjectMapper();
        service = new AccountService(accounts, members, auth);

        accountId = UUID.randomUUID();
        familyId = UUID.randomUUID();

        account = new Account("afsara@hearth.local", "hashedPassword", "Afsara Mannan");
        account.setPhone("+8801700000000");
        account.setAbout("Software Architect");

        member = new Member(familyId, "Afsara Mannan", "afsara@hearth.local", "Mother", Member.LEAD, Member.ACTIVE, Availability.weekdays());
        member.setAccountId(account.getId());
    }

    @Test
    @DisplayName("get() returns AccountView when account exists")
    void get_returnsAccountView() {
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        AccountView view = service.get(accountId);

        assertThat(view).isNotNull();
        assertThat(view.name()).isEqualTo("Afsara Mannan");
        assertThat(view.email()).isEqualTo("afsara@hearth.local");
        assertThat(view.phone()).isEqualTo("+8801700000000");
        assertThat(view.about()).isEqualTo("Software Architect");
    }

    @Test
    @DisplayName("get() throws 401 unauthorized when account not found")
    void get_throwsUnauthorized_whenAccountNotFound() {
        when(accounts.findById(accountId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(accountId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Your session has ended. Sign in again");
    }

    @Test
    @DisplayName("update() updates name, phone, about and preserves email verification when email unchanged")
    void update_updatesProfileDetails_whenEmailUnchanged() {
        account.setEmailVerified(true);
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        ObjectNode patch = mapper.createObjectNode();
        patch.put("name", "Afsara Saima Mannan");
        patch.put("email", "afsara@hearth.local");
        patch.put("phone", "+8801811111111");
        patch.put("about", "Lead Architect and Family Organiser");
        patch.put("whatsappAlerts", true);

        AccountView updated = service.update(accountId, patch);

        assertThat(updated.name()).isEqualTo("Afsara Saima Mannan");
        assertThat(updated.phone()).isEqualTo("+8801811111111");
        assertThat(account.getAbout()).isEqualTo("Lead Architect and Family Organiser");
        assertThat(account.isWhatsappAlerts()).isTrue();
        assertThat(account.isEmailVerified()).isTrue();

        verify(accounts).save(account);
        verify(members).save(member);
        verify(auth, never()).sendVerification(any());
    }

    @Test
    @DisplayName("update() resets emailVerified and triggers verification email when email changes")
    void update_resetsEmailVerified_andSendsVerification_whenEmailChanges() {
        account.setEmailVerified(true);
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));
        when(accounts.findByEmail("new.email@hearth.local")).thenReturn(Optional.empty());
        when(members.findByFamilyIdAndEmail(familyId, "new.email@hearth.local")).thenReturn(Optional.empty());

        ObjectNode patch = mapper.createObjectNode();
        patch.put("name", "Afsara Mannan");
        patch.put("email", "new.email@hearth.local");

        AccountView updated = service.update(accountId, patch);

        assertThat(updated.email()).isEqualTo("new.email@hearth.local");
        assertThat(account.isEmailVerified()).isFalse();

        verify(accounts).save(account);
        verify(members).save(member);
        verify(auth).sendVerification(account);
    }

    @Test
    @DisplayName("update() throws 409 conflict when new email is already registered to another account")
    void update_throwsConflict_whenEmailAlreadyTaken() {
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        Account anotherAccount = new Account("taken@hearth.local", "hash", "Other User");
        when(accounts.findByEmail("taken@hearth.local")).thenReturn(Optional.of(anotherAccount));

        ObjectNode patch = mapper.createObjectNode();
        patch.put("name", "Afsara Mannan");
        patch.put("email", "taken@hearth.local");

        assertThatThrownBy(() -> service.update(accountId, patch))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Another account already uses this email address");

        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("update() throws 422 unprocessable when email format is invalid")
    void update_throwsUnprocessable_whenEmailFormatInvalid() {
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        ObjectNode patch = mapper.createObjectNode();
        patch.put("name", "Afsara Mannan");
        patch.put("email", "not-a-valid-email");

        assertThatThrownBy(() -> service.update(accountId, patch))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Enter a valid email address");

        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("update() throws 422 unprocessable when phone number format is invalid")
    void update_throwsUnprocessable_whenPhoneInvalid() {
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        ObjectNode patch = mapper.createObjectNode();
        patch.put("name", "Afsara Mannan");
        patch.put("email", "afsara@hearth.local");
        patch.put("phone", "invalid phone letters abc");

        assertThatThrownBy(() -> service.update(accountId, patch))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Enter a valid phone number");

        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("update() accepts valid data:image/ profile photo and rejects non-data URI")
    void update_validatesProfilePhotoDataUri() {
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(members.findByAccountId(accountId)).thenReturn(Optional.of(member));

        ObjectNode validPatch = mapper.createObjectNode();
        validPatch.put("name", "Afsara Mannan");
        validPatch.put("email", "afsara@hearth.local");
        validPatch.put("photo", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

        service.update(accountId, validPatch);
        assertThat(account.getPhoto()).startsWith("data:image/png;base64");

        ObjectNode invalidPatch = mapper.createObjectNode();
        invalidPatch.put("name", "Afsara Mannan");
        invalidPatch.put("email", "afsara@hearth.local");
        invalidPatch.put("photo", "https://malicious-site.com/avatar.jpg");

        assertThatThrownBy(() -> service.update(accountId, invalidPatch))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Choose a JPG, PNG or WebP picture");
    }
}
