package com.hearth.notification.repository;

import com.hearth.notification.entity.Notification;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Newest first: the ones addressed to the member, and the family-wide ones, leaving out the member's own
     * actions unless {@code includeOwnActions}. Filtering here (not after the page is cut) keeps other people's
     * targeted notifications from using up the page.
     */
    @Query("select n from Notification n where n.familyId = :familyId and (n.recipientMemberId = :memberId"
            + " or (n.recipientMemberId is null and (:includeOwnActions = true or n.actorMemberId is null or n.actorMemberId <> :memberId)))"
            + " order by n.createdAt desc")
    List<Notification> findVisibleTo(@Param("familyId") UUID familyId, @Param("memberId") UUID memberId, @Param("includeOwnActions") boolean includeOwnActions, Pageable page);

    Optional<Notification> findByIdAndFamilyId(UUID id, UUID familyId);

    boolean existsByEventId(UUID eventId);
}
