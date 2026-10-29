package com.hearth.family.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.common.error.ApiException;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.OneTimeToken;
import com.hearth.family.domain.RefreshToken;
import com.hearth.family.dto.FamilyDtos.AuthResponse;
import com.hearth.family.dto.FamilyDtos.SignUpRequest;
import com.hearth.family.dto.FamilyDtos.TokenPair;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import com.hearth.family.repository.OneTimeTokenRepository;
import com.hearth.family.repository.RefreshTokenRepository;
import com.hearth.family.security.AccessTokens;
import com.hearth.family.security.SecureTokens;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

    private AccountRepository accounts;
    private MemberRepository members;
    private RefreshTokenRepository refreshTokens;
    private OneTimeTokenRepository oneTimeTokens;
    private PasswordEncoder passwords;
    private AccessTokens accessTokens;
    private Mailer mailer;
    private AuthService service;

    @BeforeEach
    void setUp() {
        accounts = mock(AccountRepository.class);
        members = mock(MemberRepository.class);
        refreshTokens = mock(RefreshTokenRepository.class);
        oneTimeTokens = mock(OneTimeTokenRepository.class);
        passwords = mock(PasswordEncoder.class);
        accessTokens = mock(AccessTokens.class);
        mailer = mock(Mailer.class);

        when(passwords.encode(anyString())).thenReturn("hashed_secret");

        service = new AuthService(
                accounts,
                members,
                refreshTokens,
                oneTimeTokens,
                passwords,
                accessTokens,
                mailer,
                30L
        );
    }

    @Test
    @DisplayName("signUp() creates account, dispatches verification email, and returns auth response")
    void signUp_success() {
        SignUpRequest request = new SignUpRequest("Afsara Mannan", "afsara@hearth.local", "StrongPass123!");
        when(accounts.findByEmail("afsara@hearth.local")).thenReturn(Optional.empty());
        when(accessTokens.issue(any())).thenReturn("jwt_access_token");

        AuthResponse response = service.signUp(request);

        assertThat(response).isNotNull();
        assertThat(response.token()).isEqualTo("jwt_access_token");
        assertThat(response.refreshToken()).isNotNull();
        assertThat(response.session().account().email()).isEqualTo("afsara@hearth.local");

        verify(accounts).saveAndFlush(any(Account.class));
        verify(oneTimeTokens).save(any(OneTimeToken.class));
        verify(mailer).confirmEmail(eq("afsara@hearth.local"), eq("Afsara Mannan"), anyString());
    }

    @Test
    @DisplayName("signUp() throws 409 conflict when email already exists")
    void signUp_fails_whenEmailExists() {
        SignUpRequest request = new SignUpRequest("Afsara Mannan", "existing@hearth.local", "StrongPass123!");
        Account existing = new Account("existing@hearth.local", "hash", "Existing User");
        when(accounts.findByEmail("existing@hearth.local")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.signUp(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("An account with this email already exists");

        verify(accounts, never()).saveAndFlush(any());
        verify(mailer, never()).confirmEmail(any(), any(), any());
    }

    @Test
    @DisplayName("signUp() throws 422 unprocessable when password violates security policy")
    void signUp_fails_whenPasswordWeak() {
        SignUpRequest request = new SignUpRequest("Afsara Mannan", "afsara@hearth.local", "weak");

        assertThatThrownBy(() -> service.signUp(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Password needs");

        verify(accounts, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("signIn() returns auth tokens on valid credentials")
    void signIn_success() {
        Account account = new Account("afsara@hearth.local", "correct_hash", "Afsara Mannan");
        when(accounts.findByEmail("afsara@hearth.local")).thenReturn(Optional.of(account));
        when(passwords.matches("CorrectPass123!", "correct_hash")).thenReturn(true);
        when(accessTokens.issue(any())).thenReturn("jwt_access_token");

        AuthResponse response = service.signIn("afsara@hearth.local", "CorrectPass123!");

        assertThat(response).isNotNull();
        assertThat(response.token()).isEqualTo("jwt_access_token");
        verify(accounts).save(account);
    }

    @Test
    @DisplayName("signIn() increments failed sign in counter and throws 401 on wrong password")
    void signIn_fails_onWrongPassword() {
        Account account = new Account("afsara@hearth.local", "correct_hash", "Afsara Mannan");
        when(accounts.findByEmail("afsara@hearth.local")).thenReturn(Optional.of(account));
        when(passwords.matches("WrongPass123!", "correct_hash")).thenReturn(false);

        assertThatThrownBy(() -> service.signIn("afsara@hearth.local", "WrongPass123!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That email and password don’t match");

        verify(accounts).save(account);
    }

    @Test
    @DisplayName("signIn() checks decoy hash to protect against timing attacks when email does not exist")
    void signIn_mitigatesTimingAttack_onUnknownEmail() {
        when(accounts.findByEmail("unknown@hearth.local")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.signIn("unknown@hearth.local", "Secret123!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("That email and password don’t match");

        verify(passwords).matches(eq("Secret123!"), anyString());
    }

    @Test
    @DisplayName("signIn() throws 429 too many requests when account is temporarily locked")
    void signIn_fails_whenAccountLocked() {
        Account lockedAccount = new Account("locked@hearth.local", "hash", "Locked User");
        for (int i = 0; i < 5; i++) {
            lockedAccount.recordFailedSignIn(5, Instant.now().plus(15, ChronoUnit.MINUTES));
        }
        when(accounts.findByEmail("locked@hearth.local")).thenReturn(Optional.of(lockedAccount));

        assertThatThrownBy(() -> service.signIn("locked@hearth.local", "Pass123!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Too many attempts. Wait 15 minutes");

        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("refresh() rotates refresh token and returns new token pair")
    void refresh_success() {
        UUID accountId = UUID.randomUUID();
        String rawToken = "usable_refresh_secret";
        String tokenHash = SecureTokens.hash(rawToken);

        RefreshToken stored = new RefreshToken(accountId, tokenHash, Instant.now().plus(30, ChronoUnit.DAYS));
        when(refreshTokens.findByTokenHash(tokenHash)).thenReturn(Optional.of(stored));
        when(accessTokens.issue(accountId)).thenReturn("new_jwt_access");

        TokenPair tokens = service.refresh(rawToken);

        assertThat(tokens).isNotNull();
        assertThat(tokens.token()).isEqualTo("new_jwt_access");
        assertThat(tokens.refreshToken()).isNotNull();
        assertThat(stored.getRevokedAt()).isNotNull();

        verify(refreshTokens).save(stored);
    }

    @Test
    @DisplayName("refresh() invalidates all sessions when an already revoked refresh token is replayed")
    void refresh_detectsTokenReuse_andRevokesAllSessions() {
        UUID accountId = UUID.randomUUID();
        String replayedToken = "replayed_secret";
        String tokenHash = SecureTokens.hash(replayedToken);

        RefreshToken alreadyRevoked = new RefreshToken(accountId, tokenHash, Instant.now().plus(30, ChronoUnit.DAYS));
        alreadyRevoked.revoke();

        when(refreshTokens.findByTokenHash(tokenHash)).thenReturn(Optional.of(alreadyRevoked));

        assertThatThrownBy(() -> service.refresh(replayedToken))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Your session has ended. Sign in again");

        verify(refreshTokens).revokeAll(eq(accountId), any(Instant.class));
    }

    @Test
    @DisplayName("signOut() revokes the provided refresh token")
    void signOut_revokesToken() {
        String rawToken = "sign_out_secret";
        String tokenHash = SecureTokens.hash(rawToken);

        RefreshToken token = new RefreshToken(UUID.randomUUID(), tokenHash, Instant.now().plus(30, ChronoUnit.DAYS));
        when(refreshTokens.findByTokenHash(tokenHash)).thenReturn(Optional.of(token));

        service.signOut(rawToken);

        assertThat(token.getRevokedAt()).isNotNull();
        verify(refreshTokens).save(token);
    }

    @Test
    @DisplayName("verifyEmail() marks account emailVerified when one-time token is valid")
    void verifyEmail_success() {
        UUID accountId = UUID.randomUUID();
        String rawSecret = "verify_secret";
        String tokenHash = SecureTokens.hash(rawSecret);

        OneTimeToken ott = new OneTimeToken(accountId, OneTimeToken.VERIFY_EMAIL, tokenHash, Instant.now().plus(2, ChronoUnit.DAYS));
        when(oneTimeTokens.findByTokenHash(tokenHash)).thenReturn(Optional.of(ott));

        Account account = new Account("afsara@hearth.local", "hash", "Afsara Mannan");
        account.setEmailVerified(false);
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));

        service.verifyEmail(rawSecret);

        assertThat(account.isEmailVerified()).isTrue();
        assertThat(ott.isUsable(Instant.now())).isFalse();
    }
}
