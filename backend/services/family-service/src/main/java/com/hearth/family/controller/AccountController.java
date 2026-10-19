package com.hearth.family.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.family.dto.FamilyDtos.AccountView;
import com.hearth.family.service.AccountService;
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
        return accounts.get();
    }

    /** Send only the fields to change. A field sent as null is cleared (e.g. {@code {"photo": null}}). */
    @PatchMapping
    public AccountView update(@RequestBody JsonNode body) {
        return accounts.update(body);
    }
}
