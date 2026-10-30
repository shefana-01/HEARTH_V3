package com.hearth.common.events;

import io.micrometer.core.instrument.MeterRegistry;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * What a consumer does when handling an event fails: try again three times, one second apart (a database
 * hiccup usually passes), then park the event on the topic's dead-letter topic ({@code <topic>.DLT}, same
 * partition) with the error in its headers, and move on, so one bad event cannot stop the whole topic and
 * nothing is lost. See docs/operations/RUNBOOK.md for inspecting and replaying parked events.
 */
@Configuration
public class KafkaConsumerConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerConfig.class);
    public static final String DLT_SUFFIX = ".DLT";

    @Bean
    public CommonErrorHandler kafkaErrorHandler(KafkaOperations<Object, Object> template, ObjectProvider<MeterRegistry> meters) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template, KafkaConsumerConfig::deadLetterFor);
        return new DefaultErrorHandler((record, ex) -> {
            log.error("Parking event at {}-{}@{} on {}{} after retries: {}", record.topic(), record.partition(), record.offset(), record.topic(), DLT_SUFFIX, ex.getMessage(), ex);
            MeterRegistry registry = meters.getIfAvailable();
            if (registry != null) {
                registry.counter("hearth.events.dead.lettered", "topic", record.topic()).increment();
            }
            recoverer.accept(record, ex);
        }, new FixedBackOff(1000L, 3));
    }

    /** Same partition on the dead-letter topic, so a family's parked events keep their order. */
    static TopicPartition deadLetterFor(ConsumerRecord<?, ?> record, Exception ex) {
        return new TopicPartition(record.topic() + DLT_SUFFIX, record.partition());
    }
}
