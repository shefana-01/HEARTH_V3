package com.hearth.family.api;

import com.hearth.family.application.InviteService;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.dto.FamilyDtos.InviteLookup;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invites")
public class InviteController {

    private final InviteService invites;

    public InviteController(InviteService invites) {
        this.invites = invites;
    }

    @GetMapping("/{code}")
    public InviteLookup lookup(@PathVariable String code) {
        return invites.lookup(code);
    }

    @PostMapping("/{code}/accept")
    public FamilyView accept(@PathVariable String code) {
        return invites.accept(code);
    }
}
