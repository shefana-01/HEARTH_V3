package com.hearth.audit.repository;

import com.hearth.audit.entity.AuditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    List<AuditEvent> findTop500ByFamilyIdOrderByOccurredAtDesc(UUID familyId);
    boolean existsByEventId(UUID eventId);
}
