package com.hearth.family.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.web.Patch;
import com.hearth.family.auth.IdentityProvider;
import com.hearth.family.dto.FamilyDtos.AccountView;
import com.hearth.family.email.Emails;
import com.hearth.family.entity.Account;
import com.hearth.family.entity.Member;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    /** A 256 px JPEG is about 25 KB as a data URL; this leaves room without letting the table bloat. */
    private static final int MAX_PHOTO_CHARS = 200_000;

    private final CurrentAccount currentAccount;
    private final AccountRepository accounts;
    private final MemberRepository members;
    private final IdentityProvider identity;
    private final Emails emails;

    public AccountService(CurrentAccount currentAccount, AccountRepository accounts, MemberRepository members, IdentityProvider identity, Emails emails) {
        this.emails = emails;
        this.currentAccount = currentAccount;
        this.accounts = accounts;
        this.members = members;
        this.identity = identity;
    }

    @Transactional(readOnly = true)
    public AccountView get() {
        Account account = currentAccount.require();
        return Views.account(account, members.findByAccountId(account.getId()).map(Member::getId).orElse(null));
    }

    @Transactional
    public AccountView update(JsonNode body) {
        Account account = currentAccount.require();
        String emailBefore = account.getEmail();
        Patch patch = Patch.of(body);

        patch.requiredText("name", 80, account::setName);
        patch.text("phone", 40, value -> account.setPhone(value == null || value.isBlank() ? null : value));
        patch.text("about", 400, value -> account.setAbout(value == null ? "" : value));
        patch.bool("whatsappAlerts", account::setWhatsappAlerts);
        patch.text("photo", MAX_PHOTO_CHARS, value -> {
            if (value != null && !value.startsWith("data:image/")) {
                throw ApiException.badRequest("The profile photo must be an image.");
            }
            account.setPhoto(value);
        });
        patch.requiredText("email", 255, value -> {
            if (value.equalsIgnoreCase(account.getEmail())) {
                return;
            }
            if (!EMAIL.matcher(value).matches()) {
                throw ApiException.badRequest("Enter a valid email address.");
            }
            if (accounts.existsByEmailIgnoreCase(value)) {
                throw ApiException.conflict("Another account already uses this email address.");
            }
            account.setEmail(value);
            identity.updateEmail(account.getSubject(), value);
        });
        if (!account.getEmail().equalsIgnoreCase(emailBefore)) {
            // A new address has to be confirmed like the first one was.
            account.setEmailVerified(false);
            emails.confirmAddress(account);
        }
        accounts.save(account);

        // The member card shows the same name, contact details and photo.
        Optional<Member> member = members.findByAccountId(account.getId());
        member.ifPresent(m -> {
            m.setName(account.getName());
            m.setEmail(account.getEmail());
            m.setPhone(account.getPhone());
            m.setPhoto(account.getPhoto());
            members.save(m);
        });
        return Views.account(account, member.map(Member::getId).orElse(null));
    }
}
