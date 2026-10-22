package com.hearth.common.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * What a consumer does when handling an event fails: try again three times, one second apart (a database
 * hiccup usually passes), then log it and move on, so one bad event cannot stop the whole topic.
 */
@Configuration
public class KafkaConsumerConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerConfig.class);

    @Bean
    public CommonErrorHandler kafkaErrorHandler() {
        return new DefaultErrorHandler(
                (record, ex) -> log.error("Giving up on event at {}-{}@{}: {}", record.topic(), record.partition(), record.offset(), ex.getMessage(), ex),
                new FixedBackOff(1000L, 3));
    }
}
