package com.hearth.family.application;

import com.hearth.family.domain.*;
import com.hearth.family.dto.FamilyDtos.*;
import com.hearth.family.infrastructure.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FamilyService {

    private final FamilyRepository familyRepository;
    private final FamilyMemberRepository memberRepository;
    private final UserRepository userRepository;

    @Transactional
    public FamilyResponse createFamily(CreateFamilyRequest request, UUID creatorUserId) {
        Family family = Family.builder()
                .name(request.getName())
                .createdBy(creatorUserId)
                .build();
        Family saved = familyRepository.save(family);

        // Assign creator as ADMIN
        FamilyMember adminMember = FamilyMember.builder()
                .familyId(saved.getId())
                .userId(creatorUserId)
                .role(MemberRole.ADMIN)
                .status("ACTIVE")
                .build();
        memberRepository.save(adminMember);

        return FamilyResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .createdBy(saved.getCreatedBy())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    public List<FamilyResponse> getFamiliesForUser(UUID userId) {
        List<FamilyMember> memberships = memberRepository.findByUserId(userId);
        return memberships.stream()
                .map(m -> familyRepository.findById(m.getFamilyId()).orElse(null))
                .filter(f -> f != null)
                .map(f -> FamilyResponse.builder()
                        .id(f.getId())
                        .name(f.getName())
                        .createdBy(f.getCreatedBy())
                        .createdAt(f.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    public List<MemberResponse> getFamilyMembers(UUID familyId) {
        return memberRepository.findByFamilyId(familyId).stream()
                .map(m -> MemberResponse.builder()
                        .id(m.getId())
                        .familyId(m.getFamilyId())
                        .userId(m.getUserId())
                        .role(m.getRole().name())
                        .status(m.getStatus())
                        .joinedAt(m.getJoinedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
