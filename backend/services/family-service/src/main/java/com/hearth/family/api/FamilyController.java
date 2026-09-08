package com.hearth.family.api;

import com.hearth.family.application.FamilyService;
import com.hearth.family.dto.FamilyDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/families")
@RequiredArgsConstructor
public class FamilyController {

    private final FamilyService familyService;

    @PostMapping
    public ResponseEntity<FamilyResponse> createFamily(
            @Valid @RequestBody CreateFamilyRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "00000000-0000-0000-0000-000000000001") UUID userId) {
        return ResponseEntity.ok(familyService.createFamily(request, userId));
    }

    @GetMapping
    public ResponseEntity<List<FamilyResponse>> getUserFamilies(
            @RequestHeader(value = "X-User-Id", defaultValue = "00000000-0000-0000-0000-000000000001") UUID userId) {
        return ResponseEntity.ok(familyService.getFamiliesForUser(userId));
    }

    @GetMapping("/{familyId}/members")
    public ResponseEntity<List<MemberResponse>> getFamilyMembers(@PathVariable UUID familyId) {
        return ResponseEntity.ok(familyService.getFamilyMembers(familyId));
    }
}
