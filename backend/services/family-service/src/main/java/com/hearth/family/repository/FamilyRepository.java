package com.hearth.family.repository;

import com.hearth.family.domain.Family;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FamilyRepository extends JpaRepository<Family, UUID> {

    Optional<Family> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
