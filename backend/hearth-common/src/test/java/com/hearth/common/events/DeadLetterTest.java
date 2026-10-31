package com.hearth.common.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.support.SendResult;

class DeadLetterTest {

    @Test
    @DisplayName("a dead-lettered event keeps its partition on <topic>.DLT")
    void samePartitionOnTheDeadLetterTopic() {
        ConsumerRecord<String, String> record = new ConsumerRecord<>(Topics.TASK, 2, 41L, "family-1", "{}");
        assertThat(KafkaConsumerConfig.deadLetterFor(record, new IllegalStateException())).isEqualTo(new TopicPartition("hearth.task.events.DLT", 2));
    }

    @Test
    @DisplayName("after three retries the event is published to the dead-letter topic and counted")
    @SuppressWarnings("unchecked")
    void retriesThenParks() {
        KafkaOperations<Object, Object> kafka = mock(KafkaOperations.class);
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));
        when(kafka.isTransactional()).thenReturn(false);
        MeterRegistry registry = new SimpleMeterRegistry();
        ObjectProvider<MeterRegistry> meters = mock(ObjectProvider.class);
        when(meters.getIfAvailable()).thenReturn(registry);
        CommonErrorHandler handler = new KafkaConsumerConfig().kafkaErrorHandler(kafka, meters);

        ConsumerRecord<String, String> record = new ConsumerRecord<>(Topics.CARE, 1, 7L, "family-1", "{\"broken\":true}");
        Consumer<?, ?> consumer = mock(Consumer.class);
        MessageListenerContainer container = mock(MessageListenerContainer.class);
        when(container.isRunning()).thenReturn(true);
        RuntimeException failure = new RuntimeException("database is down");

        boolean handled = false;
        for (int attempt = 0; attempt < 3; attempt++) {
            handled = handler.handleOne(failure, record, consumer, container);
            assertThat(handled).as("attempt %d is retried", attempt + 1).isFalse();
        }
        verify(kafka, never()).send(any(ProducerRecord.class));
        handled = handler.handleOne(failure, record, consumer, container);

        assertThat(handled).isTrue();
        ArgumentCaptor<ProducerRecord<Object, Object>> sent = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(sent.capture());
        assertThat(sent.getValue().topic()).isEqualTo("hearth.care.events.DLT");
        assertThat(sent.getValue().partition()).isEqualTo(1);
        assertThat(sent.getValue().value()).isEqualTo("{\"broken\":true}");
        assertThat(sent.getValue().headers().lastHeader("kafka_dlt-exception-message")).isNotNull();
        assertThat(registry.counter("hearth.events.dead.lettered", "topic", Topics.CARE).count()).isEqualTo(1.0);
    }
}
