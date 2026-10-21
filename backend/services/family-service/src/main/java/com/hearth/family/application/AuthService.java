package com.hearth.family.application;

import com.hearth.common.error.ApiException;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Member;
import com.hearth.family.domain.OneTimeToken;
import com.hearth.family.domain.RefreshToken;
import com.hearth.family.dto.FamilyDtos.AuthResponse;
import com.hearth.family.dto.FamilyDtos.SessionView;
import com.hearth.family.dto.FamilyDtos.SignUpRequest;
import com.hearth.family.dto.FamilyDtos.TokenPair;
import com.hearth.family.mail.Mailer;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import com.hearth.family.repository.OneTimeTokenRepository;
import com.hearth.family.repository.RefreshTokenRepository;
import com.hearth.family.security.AccessTokens;
import com.hearth.family.security.PasswordPolicy;
import com.hearth.family.security.SecureTokens;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creating accounts, signing in and out, renewing sessions, confirming email addresses and resetting
 * passwords.
 *
 * Security choices, briefly: passwords are BCrypt hashes; the access token is a 15-minute RS256 JWT;
 * the refresh token is a random secret stored only as a hash and replaced on every use. Presenting a
 * refresh token that was already replaced means it was copied, so every session of that account ends.
 * Wrong passwords get one generic message (no hint whether the email exists), and after five in a row
 * sign-in pauses for 15 minutes.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_FAILED_SIGN_INS = 5;
    private static final Duration LOCK_TIME = Duration.ofMinutes(15);
    private static final Duration VERIFY_LINK_LIFETIME = Duration.ofDays(2);
    private static final Duration RESET_LINK_LIFETIME = Duration.ofHours(1);
    private static final String WRONG_CREDENTIALS = "That email and password don’t match. Check them and try again.";

    private final AccountRepository accounts;
    private final MemberRepository members;
    private final RefreshTokenRepository refreshTokens;
    private final OneTimeTokenRepository oneTimeTokens;
    private final PasswordEncoder passwords;
    private final AccessTokens accessTokens;
    private final Mailer mailer;
    private final Duration refreshLifetime;
    /** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
    private final String decoyHash;

    public AuthService(
            AccountRepository accounts,
            MemberRepository members,
            RefreshTokenRepository refreshTokens,
            OneTimeTokenRepository oneTimeTokens,
            PasswordEncoder passwords,
            AccessTokens accessTokens,
            Mailer mailer,
            @Value("${hearth.auth.refresh-token-days:30}") long refreshDays) {
        this.accounts = accounts;
        this.members = members;
        this.refreshTokens = refreshTokens;
        this.oneTimeTokens = oneTimeTokens;
        this.passwords = passwords;
        this.accessTokens = accessTokens;
        this.mailer = mailer;
        this.refreshLifetime = Duration.ofDays(refreshDays);
        this.decoyHash = passwords.encode(SecureTokens.newSecret());
    }

    @Transactional
    public AuthResponse signUp(SignUpRequest request) {
        String email = request.email().trim();
        PasswordPolicy.check(request.password());
        if (accounts.findByEmail(email).isPresent()) {
            throw ApiException.conflict("An account with this email already exists. Sign in instead.");
        }
        Account account = new Account(email, passwords.encode(request.password()), request.name().trim());
        accounts.saveAndFlush(account);
        sendVerification(account);
        return authResponse(account);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse signIn(String email, String password) {
        Account account = accounts.findByEmail(email.trim()).orElse(null);
        if (account == null) {
            passwords.matches(password, decoyHash);
            throw ApiException.unauthorized(WRONG_CREDENTIALS);
        }
        Instant now = Instant.now();
        if (account.isLocked(now)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Wait 15 minutes, or reset your password.");
        }
        if (!passwords.matches(password, account.getPasswordHash())) {
            account.recordFailedSignIn(MAX_FAILED_SIGN_INS, now.plus(LOCK_TIME));
            accounts.save(account);
            throw ApiException.unauthorized(WRONG_CREDENTIALS);
        }
        account.recordSuccessfulSignIn();
        accounts.save(account);
        return authResponse(account);
    }

    /** Swaps a refresh token for a new pair. Each refresh token works once. */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        RefreshToken stored = refreshTokens.findByTokenHash(SecureTokens.hash(refreshToken)).orElseThrow(AuthService::sessionEnded);
        Instant now = Instant.now();
        if (stored.getRevokedAt() != null) {
            // A replaced token came back: someone kept a copy. End every session of this account.
            refreshTokens.revokeAll(stored.getAccountId(), now);
            log.warn("A refresh token was used twice; signed account {} out everywhere", stored.getAccountId());
            throw sessionEnded();
        }
        if (!stored.isUsable(now)) {
            throw sessionEnded();
        }
        stored.revoke();
        refreshTokens.save(stored);
        return new TokenPair(accessTokens.issue(stored.getAccountId()), newRefreshToken(stored.getAccountId()));
    }

    /** Ends this session: the refresh token stops working. Unknown tokens are ignored. */
    @Transactional
    public void signOut(String refreshToken) {
        refreshTokens.findByTokenHash(SecureTokens.hash(refreshToken)).ifPresent(token -> {
            token.revoke();
            refreshTokens.save(token);
        });
    }

    @Transactional(readOnly = true)
    public SessionView session(UUID accountId) {
        Account account = accounts.findById(accountId).orElseThrow(AuthService::sessionEnded);
        return session(account);
    }

    @Transactional
    public void verifyEmail(String token) {
        OneTimeToken stored = usableToken(token, OneTimeToken.VERIFY_EMAIL, "This link has expired or was already used. Sign in and ask for a new one.");
        stored.use();
        Account account = accounts.findById(stored.getAccountId()).orElseThrow(() -> ApiException.notFound("That account"));
        account.setEmailVerified(true);
    }

    @Transactional
    public void resendVerification(UUID accountId) {
        Account account = accounts.findById(accountId).orElseThrow(AuthService::sessionEnded);
        if (account.isEmailVerified()) {
            return;
        }
        sendVerification(account);
    }

    /** Always answers the same way, so nobody can find out which addresses have an account. */
    @Transactional
    public void requestPasswordReset(String email) {
        accounts.findByEmail(email.trim()).ifPresent(account -> {
            oneTimeTokens.retireOpen(account.getId(), OneTimeToken.PASSWORD_RESET, Instant.now());
            String secret = SecureTokens.newSecret();
            oneTimeTokens.save(new OneTimeToken(account.getId(), OneTimeToken.PASSWORD_RESET, SecureTokens.hash(secret), Instant.now().plus(RESET_LINK_LIFETIME)));
            mailer.resetPassword(account.getEmail(), account.getName(), secret);
        });
    }

    /** Sets the new password and signs the account out everywhere. Opening the link also proves the email address. */
    @Transactional
    public void confirmPasswordReset(String token, String newPassword) {
        PasswordPolicy.check(newPassword);
        OneTimeToken stored = usableToken(token, OneTimeToken.PASSWORD_RESET, "This link has expired or was already used. Ask for a new one.");
        stored.use();
        Account account = accounts.findById(stored.getAccountId()).orElseThrow(() -> ApiException.notFound("That account"));
        account.setPasswordHash(passwords.encode(newPassword));
        account.setEmailVerified(true);
        account.recordSuccessfulSignIn();
        refreshTokens.revokeAll(account.getId(), Instant.now());
    }

    /** Sends (again) the link that confirms the account's email address. Older links stop working. */
    @Transactional
    public void sendVerification(Account account) {
        oneTimeTokens.retireOpen(account.getId(), OneTimeToken.VERIFY_EMAIL, Instant.now());
        String secret = SecureTokens.newSecret();
        oneTimeTokens.save(new OneTimeToken(account.getId(), OneTimeToken.VERIFY_EMAIL, SecureTokens.hash(secret), Instant.now().plus(VERIFY_LINK_LIFETIME)));
        mailer.confirmEmail(account.getEmail(), account.getName(), secret);
    }

    /** Old tokens are of no use to anyone; remove them once a day. */
    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void removeExpiredTokens() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(1));
        int removed = refreshTokens.deleteExpiredBefore(cutoff) + oneTimeTokens.deleteExpiredBefore(cutoff);
        log.info("Removed {} expired token(s)", removed);
    }

    private OneTimeToken usableToken(String token, String purpose, String expiredMessage) {
        OneTimeToken stored = oneTimeTokens.findByTokenHash(SecureTokens.hash(token.trim()))
                .filter(found -> found.getPurpose().equals(purpose))
                .orElseThrow(() -> ApiException.badRequest("This link is not valid. Open the link from the email again."));
        if (!stored.isUsable(Instant.now())) {
            throw new ApiException(HttpStatus.GONE, expiredMessage);
        }
        return stored;
    }

    private AuthResponse authResponse(Account account) {
        return new AuthResponse(accessTokens.issue(account.getId()), newRefreshToken(account.getId()), session(account));
    }

    private String newRefreshToken(UUID accountId) {
        String secret = SecureTokens.newSecret();
        refreshTokens.save(new RefreshToken(accountId, SecureTokens.hash(secret), Instant.now().plus(refreshLifetime)));
        return secret;
    }

    private SessionView session(Account account) {
        Member member = members.findByAccountId(account.getId()).orElse(null);
        return new SessionView(Views.account(account, member), member != null, false);
    }

    private static ApiException sessionEnded() {
        return ApiException.unauthorized("Your session has ended. Sign in again.");
    }
}
