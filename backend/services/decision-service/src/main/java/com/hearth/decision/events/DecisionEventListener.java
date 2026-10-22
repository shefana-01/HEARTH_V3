package com.hearth.decision.events;

import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventReader;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.ProcessedEvents;
import com.hearth.common.events.Topics;
import com.hearth.decision.application.HandoverService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opens handover requests when someone reports time away (task-service only says which shared tasks are
 * affected), and closes them when their task is cancelled or made private.
 */
@Component
@ConditionalOnProperty(name = "hearth.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class DecisionEventListener {

    private final EventReader reader;
    private final ProcessedEvents processed;
    private final HandoverService handovers;

    public DecisionEventListener(EventReader reader, ProcessedEvents processed, HandoverService handovers) {
        this.reader = reader;
        this.processed = processed;
        this.handovers = handovers;
    }

    @KafkaListener(topics = Topics.TASK)
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
        switch (event.type()) {
            case EventTypes.UNAVAILABILITY_REPORTED -> handovers.openForTimeAway(event.familyId(), event.uuid("memberId"), event.uuids("taskIds"), event.text("requestReason"), event.text("note"));
            case EventTypes.TASK_CANCELLED, EventTypes.TASK_MADE_PRIVATE -> handovers.closeFor(event.familyId(), event.uuid("taskId"));
            default -> {
                // Not relevant to handovers.
            }
        }
    }
}
