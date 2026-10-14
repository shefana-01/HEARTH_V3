package com.hearth.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** What one member did with one notification: read it, dismissed it, or both. */
@Entity
@Table(name = "notification_state")
public class NotificationState {

    @Id
    private UUID id;

    @Column(name = "notification_id", nullable = false)
    private UUID notificationId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(name = "marked_read", nullable = false)
    private boolean markedRead;

    @Column(nullable = false)
    private boolean dismissed;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getNotificationId() {
        return notificationId;
    }

    public void setNotificationId(UUID notificationId) {
        this.notificationId = notificationId;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public void setMemberId(UUID memberId) {
        this.memberId = memberId;
    }

    public boolean isMarkedRead() {
        return markedRead;
    }

    public void setMarkedRead(boolean markedRead) {
        this.markedRead = markedRead;
    }

    public boolean isDismissed() {
        return dismissed;
    }

    public void setDismissed(boolean dismissed) {
        this.dismissed = dismissed;
    }
}
