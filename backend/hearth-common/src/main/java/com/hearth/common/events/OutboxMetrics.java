package com.hearth.common.events;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * {@code hearth_outbox_pending}: events written but not yet on Kafka. Near zero normally; a growing number
 * means Kafka or the relay is down (the Grafana dashboard and the runbook alert on it).
 */
@Component
@ConditionalOnProperty(name = "hearth.outbox.enabled", havingValue = "true")
public class OutboxMetrics implements MeterBinder {

    private final JdbcTemplate jdbc;

    public OutboxMetrics(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void bindTo(MeterRegistry registry) {
        Gauge.builder("hearth.outbox.pending", this, OutboxMetrics::pending)
                .description("Events in the outbox not yet published to Kafka")
                .register(registry);
    }

    double pending() {
        try {
            Long count = jdbc.queryForObject("select count(*) from outbox_event where published_at is null", Long.class);
            return count == null ? 0 : count;
        } catch (RuntimeException ex) {
            return Double.NaN;
        }
    }
}
