package com.hearth.notification.repository;

import com.hearth.notification.entity.NotificationState;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationStateRepository extends JpaRepository<NotificationState, UUID> {

    List<NotificationState> findByMemberIdAndNotificationIdIn(UUID memberId, Collection<UUID> notificationIds);

    Optional<NotificationState> findByNotificationIdAndMemberId(UUID notificationId, UUID memberId);
}
