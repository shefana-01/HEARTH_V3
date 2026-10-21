package com.hearth.family.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.web.Patch;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Member;
import com.hearth.family.dto.FamilyDtos.AccountView;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The signed-in person's own account: name, email, phone, a short "about" line, a profile picture and
 * alert preferences. Name, email, phone and picture are also what the family sees on their member card.
 */
@Service
public class AccountService {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 ()-]{7,20}$");
    /** Pictures are resized in the browser; this is a generous limit for a small image as a data URL. */
    private static final int MAX_PHOTO_CHARS = 400_000;

    private final AccountRepository accounts;
    private final MemberRepository members;
    private final AuthService auth;

    public AccountService(AccountRepository accounts, MemberRepository members, AuthService auth) {
        this.accounts = accounts;
        this.members = members;
        this.auth = auth;
    }

    @Transactional(readOnly = true)
    public AccountView get(UUID accountId) {
        Account account = find(accountId);
        return Views.account(account, members.findByAccountId(accountId).orElse(null));
    }

    @Transactional
    public AccountView update(UUID accountId, JsonNode body) {
        Account account = find(accountId);
        Optional<Member> member = members.findByAccountId(accountId);
        String previousEmail = account.getEmail();
        Patch patch = Patch.of(body);

        patch.requiredText("name", 80, name -> {
            account.setName(name);
            member.ifPresent(m -> m.setName(name));
        });
        patch.requiredText("email", 254, email -> {
            if (!EMAIL.matcher(email).matches()) {
                throw ApiException.unprocessable("Enter a valid email address, like name@example.com.");
            }
            if (!email.equalsIgnoreCase(previousEmail)) {
                accounts.findByEmail(email).ifPresent(other -> {
                    throw ApiException.conflict("Another account already uses this email address.");
                });
                member.flatMap(m -> members.findByFamilyIdAndEmail(m.getFamilyId(), email)).filter(other -> !other.getId().equals(member.get().getId())).ifPresent(other -> {
                    throw ApiException.conflict("Someone in your family already uses this email address.");
                });
            }
            account.setEmail(email);
            member.ifPresent(m -> m.setEmail(email));
        });
        patch.text("phone", 30, phone -> {
            String value = phone == null || phone.isBlank() ? null : phone;
            if (value != null && !PHONE.matcher(value).matches()) {
                throw ApiException.unprocessable("Enter a valid phone number.");
            }
            account.setPhone(value);
            member.ifPresent(m -> m.setPhone(value));
        });
        patch.text("about", 500, about -> account.setAbout(about == null ? "" : about));
        patch.text("photo", MAX_PHOTO_CHARS, photo -> {
            if (photo != null && !photo.isBlank() && !photo.startsWith("data:image/")) {
                throw ApiException.unprocessable("Choose a JPG, PNG or WebP picture.");
            }
            account.setPhoto(photo == null || photo.isBlank() ? null : photo);
        });
        patch.bool("whatsappAlerts", account::setWhatsappAlerts);

        if (!account.getEmail().equalsIgnoreCase(previousEmail)) {
            // A new address has to be confirmed again.
            account.setEmailVerified(false);
            auth.sendVerification(account);
        }
        accounts.save(account);
        member.ifPresent(members::save);
        return Views.account(account, member.orElse(null));
    }

    private Account find(UUID accountId) {
        return accounts.findById(accountId).orElseThrow(() -> ApiException.unauthorized("Your session has ended. Sign in again."));
    }
}
