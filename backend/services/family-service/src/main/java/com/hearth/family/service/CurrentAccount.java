package com.hearth.family.service;

import com.hearth.common.error.ApiException;
import com.hearth.common.security.CurrentUser;
import com.hearth.family.entity.Account;
import com.hearth.family.repository.AccountRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** The account behind the current request's token. */
@Component
public class CurrentAccount {

    private final AccountRepository accounts;

    public CurrentAccount(AccountRepository accounts) {
        this.accounts = accounts;
    }

    public Account require() {
        return accounts.findBySubject(CurrentUser.subject()).orElseThrow(() -> ApiException.unauthorized("Sign in first."));
    }

    /** Empty on public endpoints called without a token. */
    public Optional<Account> find() {
        String subject = CurrentUser.subjectOrNull();
        return subject == null ? Optional.empty() : accounts.findBySubject(subject);
    }
}
