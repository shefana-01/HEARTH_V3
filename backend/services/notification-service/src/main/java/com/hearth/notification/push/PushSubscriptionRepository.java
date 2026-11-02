package com.hearth.notification.push;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByFamilyId(UUID familyId);

    List<PushSubscription> findByFamilyIdAndMemberId(UUID familyId, UUID memberId);

    long deleteByMemberId(UUID memberId);
}
