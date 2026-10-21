package com.hearth.notification.api;

import com.hearth.notification.application.NotificationService;
import com.hearth.notification.dto.MessageDtos.UnreadCount;
import com.hearth.notification.dto.NotificationView;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<NotificationView> list() {
        return notifications.list();
    }

    /** Polled by the browser every 30 seconds. */
    @GetMapping("/unread-count")
    public UnreadCount unreadCount() {
        return new UnreadCount(notifications.unreadCount());
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable UUID id) {
        notifications.markRead(id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead() {
        notifications.markAllRead();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@PathVariable UUID id) {
        notifications.dismiss(id);
    }
}
