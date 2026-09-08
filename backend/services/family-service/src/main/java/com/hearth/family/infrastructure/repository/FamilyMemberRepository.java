package com.hearth.family.infrastructure.repository;

import com.hearth.family.domain.FamilyMember;
import com.hearth.family.domain.MemberRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FamilyMemberRepository extends JpaRepository<FamilyMember, UUID> {
    List<FamilyMember> findByFamilyId(UUID familyId);
    List<FamilyMember> findByUserId(UUID userId);
    Optional<FamilyMember> findByFamilyIdAndUserId(UUID familyId, UUID userId);
    List<FamilyMember> findByFamilyIdAndRole(UUID familyId, MemberRole role);
}
