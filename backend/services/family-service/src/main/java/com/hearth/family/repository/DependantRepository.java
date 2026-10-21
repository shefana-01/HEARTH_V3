package com.hearth.family.repository;

import com.hearth.family.domain.Dependant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DependantRepository extends JpaRepository<Dependant, UUID> {

    List<Dependant> findByFamilyIdOrderByCreatedAtAsc(UUID familyId);

    Optional<Dependant> findByIdAndFamilyId(UUID id, UUID familyId);
}
