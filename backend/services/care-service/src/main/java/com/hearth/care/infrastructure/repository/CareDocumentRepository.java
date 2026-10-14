package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.CareDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CareDocumentRepository extends JpaRepository<CareDocument, UUID> {

    List<CareDocument> findByFamilyIdOrderByUploadedAtDesc(UUID familyId);

    Optional<CareDocument> findByIdAndFamilyId(UUID id, UUID familyId);

    List<CareDocument> findByFamilyIdAndOwnerId(UUID familyId, UUID ownerId);

    List<CareDocument> findByFamilyIdAndAppointmentId(UUID familyId, UUID appointmentId);
}
