package com.hearth.notification.events;

import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.DomainEvent.ChatInfo;
import com.hearth.common.events.DomainEvent.NotificationInfo;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.ProcessedEvents;
import com.hearth.common.events.Topics;
import com.hearth.common.text.Formats;
import com.hearth.notification.entity.Message;
import com.hearth.notification.entity.Notification;
import com.hearth.notification.repository.MessageRepository;
import com.hearth.notification.repository.NotificationRepository;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every service describes what to tell people in its events; this turns that into notifications and
 * chat lines. Each event is handled once, even if Kafka delivers it twice.
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationEventListener {

    private final EventReader reader;
    private final ProcessedEvents processed;
    private final NotificationRepository notifications;
    private final MessageRepository messages;

    public NotificationEventListener(EventReader reader, ProcessedEvents processed, NotificationRepository notifications, MessageRepository messages) {
        this.reader = reader;
        this.processed = processed;
        this.notifications = notifications;
        this.messages = messages;
    }

    @KafkaListener(topics = {Topics.FAMILY, Topics.TASK, Topics.DECISION, Topics.CARE})
    @Transactional
    public void on(String message) {
        DomainEvent event = reader.read(message);
        if (event == null || !processed.firstTime(event.eventId())) {
            return;
        }
        handle(event);
    }

    /** Public so tests can feed events without Kafka. */
    @Transactional
    public void handle(DomainEvent event) {
        NotificationInfo info = event.notification();
        if (info != null && info.message() != null && !notifications.existsByEventId(event.eventId())) {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setFamilyId(event.familyId());
            n.setType(info.type());
            n.setMessage(Formats.clip(info.message(), 500));
            n.setHref(info.href());
            n.setActorMemberId(event.actorMemberId());
            n.setRecipientMemberId(info.recipientId());
            n.setCreatedAt(event.occurredAt());
            n.setEventId(event.eventId());
            notifications.save(n);
        }
        ChatInfo chat = event.chat();
        if (chat != null && chat.text() != null && !chat.text().isBlank()) {
            Message m = new Message();
            m.setId(UUID.randomUUID());
            m.setFamilyId(event.familyId());
            m.setChannel(chat.channel() == null ? "family" : chat.channel());
            m.setAuthorId(chat.authorId());
            m.setKind(chat.kind() == null ? "system" : chat.kind());
            m.setBody(Formats.clip(chat.text(), 2000));
            m.setCreatedAt(event.occurredAt());
            messages.save(m);
        }
    }
}
