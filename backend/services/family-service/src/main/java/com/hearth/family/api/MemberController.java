package com.hearth.family.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.family.Availability;
import com.hearth.family.application.MemberService;
import com.hearth.family.dto.FamilyDtos.InviteInput;
import com.hearth.family.dto.FamilyDtos.MemberView;
import com.hearth.family.dto.FamilyDtos.StatusRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/members")
public class MemberController {

    private final MemberService members;

    public MemberController(MemberService members) {
        this.members = members;
    }

    @GetMapping
    public List<MemberView> list() {
        return members.list();
    }

    @GetMapping("/{id}")
    public MemberView get(@PathVariable UUID id) {
        return members.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MemberView invite(@Valid @RequestBody InviteInput input) {
        return members.invite(input);
    }

    /** Fields left out stay as they are. */
    @PatchMapping("/{id}")
    public MemberView update(@PathVariable UUID id, @RequestBody JsonNode body) {
        return members.update(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        members.remove(id);
    }

    @PutMapping("/{id}/status")
    public MemberView setStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return members.setStatus(id, request.text(), request.until());
    }

    @GetMapping("/{id}/availability")
    public Availability availability(@PathVariable UUID id) {
        return members.availability(id);
    }

    @PutMapping("/{id}/availability")
    public Availability saveAvailability(@PathVariable UUID id, @RequestBody Availability availability) {
        return members.saveAvailability(id, availability);
    }
}
