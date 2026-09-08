package com.hearth.notification.api;

import com.hearth.notification.application.NotificationService;
import com.hearth.notification.domain.AuditLog;
import com.hearth.notification.domain.Notification;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Notification>> getUserNotifications(@PathVariable UUID userId) {
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable UUID notificationId) {
        notificationService.markAsRead(notificationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/audit/family/{familyId}")
    public ResponseEntity<List<AuditLog>> getFamilyAuditTrail(@PathVariable UUID familyId) {
        return ResponseEntity.ok(notificationService.getFamilyAuditTrail(familyId));
    }
}
