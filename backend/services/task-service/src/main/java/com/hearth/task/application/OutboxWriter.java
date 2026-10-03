package com.hearth.task.application;

import com.hearth.task.domain.OutboxEvent;
import com.hearth.task.infrastructure.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OutboxWriter {
    private final OutboxEventRepository outboxEventRepository;

    public void writeEvent(String aggregateType, UUID aggregateId, String eventType, String payload) {
        OutboxEvent event = OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(payload)
                .build();
        outboxEventRepository.save(event);
    }
}
