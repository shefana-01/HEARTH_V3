package com.hearth.audit.repository;

import com.hearth.audit.entity.AuditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    List<AuditEvent> findTop500ByFamilyIdOrderByOccurredAtDesc(UUID familyId);
    boolean existsByEventId(UUID eventId);

    @Query("select e from AuditEvent e where e.familyId = :familyId "
            + "and (:category is null or e.category = :category) "
            + "and (:actorId is null or e.actorId = :actorId) "
            + "order by e.occurredAt desc")
    List<AuditEvent> findFiltered(@Param("familyId") UUID familyId,
                                  @Param("category") String category,
                                  @Param("actorId") UUID actorId,
                                  Pageable pageable);

    @Query("select e from AuditEvent e where e.familyId = :familyId "
            + "and (:category is null or e.category = :category) "
            + "and (:actorId is null or e.actorId = :actorId) "
            + "order by e.occurredAt desc")
    Page<AuditEvent> findFilteredPaged(@Param("familyId") UUID familyId,
                                       @Param("category") String category,
                                       @Param("actorId") UUID actorId,
                                       Pageable pageable);
}

