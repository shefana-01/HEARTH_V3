package com.hearth.notification.live;

import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.Topics;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Tells open streams when data changed anywhere in Hearth. Every instance of notification-service joins its
 * own consumer group (a random id), so each one sees every event and can reach the browsers connected to it.
 * It starts from the newest events: a browser that was away reloads everything when it reconnects.
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class LiveEventListener {

    private final EventReader reader;
    private final LiveUpdates live;

    public LiveEventListener(EventReader reader, LiveUpdates live) {
        this.reader = reader;
        this.live = live;
    }

    @KafkaListener(
            id = "live-updates",
            topics = {Topics.FAMILY, Topics.TASK, Topics.DECISION, Topics.CARE},
            groupId = "notification-live-#{T(java.util.UUID).randomUUID()}",
            properties = {"auto.offset.reset=latest", "enable.auto.commit=true"})
    public void on(String message) {
        DomainEvent event = reader.read(message);
        if (event == null || event.familyId() == null) {
            return;
        }
        Set<String> scopes = Scopes.of(event.type());
        live.publish(event.familyId(), scopes, null);
    }
}
