package com.hearth.family.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.family.application.FamilyService;
import com.hearth.family.dto.FamilyDtos.CreateFamilyRequest;
import com.hearth.family.dto.FamilyDtos.DependantInput;
import com.hearth.family.dto.FamilyDtos.DependantView;
import com.hearth.family.dto.FamilyDtos.FamilyView;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/v1/family")
public class FamilyController {

    private final FamilyService families;

    public FamilyController(FamilyService families) {
        this.families = families;
    }

    /** 204 with no body before the person has a family. */
    @GetMapping
    public ResponseEntity<FamilyView> get() {
        FamilyView family = families.get();
        return family == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(family);
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

    @PostMapping("/dependants")
    @ResponseStatus(HttpStatus.CREATED)
    public DependantView addDependant(@Valid @RequestBody DependantInput input) {
        return families.addDependant(input);
    }

    @PutMapping("/dependants/{id}")
    public DependantView updateDependant(@PathVariable UUID id, @Valid @RequestBody DependantInput input) {
        return families.updateDependant(id, input);
    }

    @DeleteMapping("/dependants/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeDependant(@PathVariable UUID id) {
        families.removeDependant(id);
    }
}
