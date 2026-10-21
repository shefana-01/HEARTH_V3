package com.hearth.family.repository;

import com.hearth.family.domain.Member;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<Member, UUID> {

    Optional<Member> findByAccountId(UUID accountId);

    List<Member> findByFamilyIdOrderByJoinedAtAsc(UUID familyId);

    Optional<Member> findByIdAndFamilyId(UUID id, UUID familyId);

    List<Member> findByFamilyIdAndRole(UUID familyId, String role);

    long countByFamilyIdAndStatus(UUID familyId, String status);

    @Query("select m from Member m where m.familyId = :familyId and lower(m.email) = lower(:email)")
    Optional<Member> findByFamilyIdAndEmail(@Param("familyId") UUID familyId, @Param("email") String email);
}
