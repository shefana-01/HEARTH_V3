package com.hearth.common.events;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

/** Creates the topics, and their dead-letter topics, on start-up if they do not exist yet. */
@Configuration
public class TopicConfig {

    @Bean
    public KafkaAdmin.NewTopics hearthTopics() {
        return new KafkaAdmin.NewTopics(
                TopicBuilder.name(Topics.FAMILY).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.TASK).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.DECISION).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.CARE).partitions(3).replicas(1).build(),
                // Dead-letter topics: same partitions so an event keeps its partition; kept for 14 days.
                deadLetter(Topics.FAMILY),
                deadLetter(Topics.TASK),
                deadLetter(Topics.DECISION),
                deadLetter(Topics.CARE));
    }

    private static org.apache.kafka.clients.admin.NewTopic deadLetter(String topic) {
        return TopicBuilder.name(topic + KafkaConsumerConfig.DLT_SUFFIX).partitions(3).replicas(1).config("retention.ms", String.valueOf(14L * 24 * 3600 * 1000)).build();
    }
}
