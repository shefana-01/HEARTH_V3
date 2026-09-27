package com.hearth.common.events;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional outbox, delivery side. Every second it sends the events that
 * are waiting to Kafka and marks them as published.
 *
 * If Kafka is down the events simply wait. If the service stops between
 * sending and marking, the event is sent again later, so consumers must be
 * idempotent ({@link ProcessedEvents}).
 */
@Component
@ConditionalOnProperty(name = "hearth.outbox.enabled", havingValue = "true")
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

    private record Pending(UUID id, String topic, String key, String payload) {
    }

    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, String> kafka;

    public OutboxRelay(JdbcTemplate jdbc, KafkaTemplate<String, String> kafka) {
        this.jdbc = jdbc;
        this.kafka = kafka;
    }

    @Scheduled(fixedDelayString = "${hearth.outbox.poll-ms:1000}")
    @Transactional
    public void deliver() {
        // "skip locked" lets several instances of a service run without sending the same row twice.
        List<Pending> batch = jdbc.query(
                "select id, topic, event_key, payload from outbox_event where published_at is null order by created_at limit 100 for update skip locked",
                (rs, row) -> new Pending(rs.getObject("id", UUID.class), rs.getString("topic"), rs.getString("event_key"), rs.getString("payload")));
        for (Pending event : batch) {
            try {
                kafka.send(event.topic(), event.key(), event.payload()).get(10, TimeUnit.SECONDS);
            } catch (Exception ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                log.warn("Kafka is not reachable; {} event(s) will be retried. Cause: {}", batch.size(), ex.getMessage());
                return;
            }
            jdbc.update("update outbox_event set published_at = now() where id = ?", event.id());
        }
    }
}
