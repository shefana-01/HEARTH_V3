package com.hearth.notification.application;

import com.hearth.notification.domain.AuditLog;
import com.hearth.notification.domain.Notification;
import com.hearth.notification.infrastructure.repository.AuditLogRepository;
import com.hearth.notification.infrastructure.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;

    public List<Notification> getUserNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Notification sendNotification(UUID userId, UUID familyId, String title, String message, String type) {
        Notification notification = Notification.builder()
                .userId(userId)
                .familyId(familyId)
                .title(title)
                .message(message)
                .type(type)
                .build();
        return notificationRepository.save(notification);
    }

    @Transactional
    public void markAsRead(UUID notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    public List<AuditLog> getFamilyAuditTrail(UUID familyId) {
        return auditLogRepository.findByFamilyIdOrderByTimestampDesc(familyId);
    }

    @Transactional
    public AuditLog recordAuditEntry(UUID familyId, UUID actorUserId, String action, String resourceType, String resourceId, String beforeJson, String afterJson) {
        AuditLog auditLog = AuditLog.builder()
                .familyId(familyId)
                .actorUserId(actorUserId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .beforeStateJson(beforeJson)
                .afterStateJson(afterJson)
                .build();
        return auditLogRepository.save(auditLog);
    }
}
