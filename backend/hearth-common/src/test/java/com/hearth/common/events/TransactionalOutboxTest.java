package com.hearth.common.events;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TransactionalOutboxTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("DomainEvent serializes and deserializes cleanly through JSON for Outbox transmission")
    void domainEventJsonRoundtrip() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID familyId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        Instant now = Instant.now();

        DomainEvent original = new DomainEvent(
                eventId,
                EventTypes.TASK_CREATED,
                now,
                familyId,
                actorId,
                new DomainEvent.AuditInfo("tasks", "Created task", "Buy groceries", null, "high"),
                new DomainEvent.NotificationInfo("task", "New task assigned", "/tasks/123", recipientId),
                new DomainEvent.ChatInfo("family", "system", "A new task was created", null),
                Map.of("taskId", "123", "priority", "high")
        );

        String json = mapper.writeValueAsString(original);
        DomainEvent deserialized = mapper.readValue(json, DomainEvent.class);

        assertThat(deserialized.eventId()).isEqualTo(eventId);
        assertThat(deserialized.type()).isEqualTo(EventTypes.TASK_CREATED);
        assertThat(deserialized.familyId()).isEqualTo(familyId);
        assertThat(deserialized.actorMemberId()).isEqualTo(actorId);
        assertThat(deserialized.audit()).isNotNull();
        assertThat(deserialized.audit().action()).isEqualTo("Created task");
        assertThat(deserialized.notification().recipientId()).isEqualTo(recipientId);
        assertThat(deserialized.chat().channel()).isEqualTo("family");
        assertThat(deserialized.text("priority")).isEqualTo("high");
    }

    @Test
    @DisplayName("Events builder creates properly configured event with audit and notification metadata")
    void eventsBuilderProducesCompleteDomainEvent() {
        UUID familyId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();

        DomainEvent event = Events.of(EventTypes.APPOINTMENT_REMINDER, familyId, actorId)
                .audit("care", "Sent reminder", "Dentist appointment")
                .notifyMember(memberId, "reminder", "Appointment in 1 hour", "/appointments/456")
                .data("appointmentId", "456")
                .build();

        assertThat(event.type()).isEqualTo(EventTypes.APPOINTMENT_REMINDER);
        assertThat(event.familyId()).isEqualTo(familyId);
        assertThat(event.actorMemberId()).isEqualTo(actorId);
        assertThat(event.audit().category()).isEqualTo("care");
        assertThat(event.notification().recipientId()).isEqualTo(memberId);
        assertThat(event.text("appointmentId")).isEqualTo("456");
    }
}
