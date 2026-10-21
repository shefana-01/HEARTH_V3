package com.hearth.family.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.security.CurrentUser;
import com.hearth.family.application.AccountService;
import com.hearth.family.dto.FamilyDtos.AccountView;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account")
public class AccountController {

    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public AccountView get() {
        return accounts.get(CurrentUser.accountId());
    }

    /** Fields left out stay as they are; a field sent as null is cleared. */
    @PatchMapping
    public AccountView update(@RequestBody JsonNode body) {
        return accounts.update(CurrentUser.accountId(), body);
    }
}
