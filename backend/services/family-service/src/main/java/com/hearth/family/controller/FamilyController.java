package com.hearth.family.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.family.dto.FamilyDtos.CreateFamilyRequest;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import com.hearth.family.service.FamilyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/family")
public class FamilyController {

    private final FamilyService families;

    public FamilyController(FamilyService families) {
        this.families = families;
    }

    /** 200 with the family, or 204 when the caller has no family yet. */
    @GetMapping
    public ResponseEntity<FamilyView> current() {
        return families.current().map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FamilyView create(@Valid @RequestBody CreateFamilyRequest request) {
        return families.create(request);
    }

    @PatchMapping
    public FamilyView update(@RequestBody JsonNode body) {
        return families.update(body);
    }
}
