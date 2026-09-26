package com.hearth.common.events;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

/** Creates the topics on start-up if they do not exist yet. */
@Configuration
public class TopicConfig {

    @Bean
    public KafkaAdmin.NewTopics hearthTopics() {
        return new KafkaAdmin.NewTopics(
                TopicBuilder.name(Topics.FAMILY).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.TASK).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.DECISION).partitions(3).replicas(1).build(),
                TopicBuilder.name(Topics.CARE).partitions(3).replicas(1).build());
    }
}
