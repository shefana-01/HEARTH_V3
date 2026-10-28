package com.hearth.common.events;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hearth.common.family.FamilyContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DomainEventTest {

    private ObjectMapper mapper;
    private final UUID familyId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("Events builder constructs valid DomainEvent from FamilyContext")
    void builderConstructsFromContext() {
        FamilyContext context = new FamilyContext(
                UUID.randomUUID(), memberId, "Afsara Mannan", familyId, "lead", true, true, true, "UTC");

        DomainEvent event = Events.of("task.created", context)
                .audit("tasks", "Created a task", "Buy groceries", null, "Weekly list")
                .notify("task", "New task added to list", "/tasks")
                .data("priority", "high")
                .data("taskId", UUID.randomUUID())
                .build();

        assertThat(event.eventId()).isNotNull();
        assertThat(event.type()).isEqualTo("task.created");
        assertThat(event.familyId()).isEqualTo(familyId);
        assertThat(event.actorMemberId()).isEqualTo(memberId);
        assertThat(event.occurredAt()).isNotNull();

        assertThat(event.audit()).isNotNull();
        assertThat(event.audit().category()).isEqualTo("tasks");
        assertThat(event.audit().action()).isEqualTo("Created a task");
        assertThat(event.audit().subject()).isEqualTo("Buy groceries");
        assertThat(event.audit().after()).isEqualTo("Weekly list");

        assertThat(event.notification()).isNotNull();
        assertThat(event.notification().message()).isEqualTo("New task added to list");
        assertThat(event.notification().recipientId()).isNull();

        assertThat(event.text("priority")).isEqualTo("high");
        assertThat(event.uuid("taskId")).isNotNull();
    }

    @Test
    @DisplayName("notifyMember creates targeted notification with recipient ID")
    void notifyMemberSetsRecipient() {
        DomainEvent event = Events.of("appointment.reminder", familyId, null)
                .notifyMember(recipientId, "appointment", "Visit starts in 1 hour", "/appointments/1")
                .build();

        assertThat(event.notification()).isNotNull();
        assertThat(event.notification().recipientId()).isEqualTo(recipientId);
        assertThat(event.actorMemberId()).isNull();
    }

    @Test
    @DisplayName("data helpers parse typed values safely")
    void dataHelpersParseTypedValues() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.parse("2026-10-26T12:00:00Z");

        DomainEvent event = Events.of("test.event", familyId, memberId)
                .data("targetId", id)
                .data("targetStrId", id.toString())
                .data("timeStr", now.toString())
                .data("ids", List.of(id.toString()))
                .build();

        assertThat(event.uuid("targetId")).isEqualTo(id);
        assertThat(event.uuid("targetStrId")).isEqualTo(id);
        assertThat(event.uuid("missing")).isNull();
        assertThat(event.text("timeStr")).isEqualTo(now.toString());
        assertThat(event.text("missing")).isNull();
        assertThat(event.uuids("ids")).containsExactly(id);
        assertThat(event.uuids("missing")).isEmpty();
    }

    @Test
    @DisplayName("systemMessage sets chat metadata for family channel")
    void systemMessageSetsChat() {
        DomainEvent event = Events.of("task.handover", familyId, memberId)
                .systemMessage("Afsara accepted task handover from Shovon")
                .build();

        assertThat(event.chat()).isNotNull();
        assertThat(event.chat().channel()).isEqualTo("family");
        assertThat(event.chat().kind()).isEqualTo("system");
        assertThat(event.chat().text()).isEqualTo("Afsara accepted task handover from Shovon");
        assertThat(event.chat().authorId()).isNull();
    }

    @Test
    @DisplayName("DomainEvent serializes and deserializes cleanly through Jackson")
    void jacksonRoundtrip() throws Exception {
        UUID eventId = UUID.randomUUID();
        Instant time = Instant.now();

        DomainEvent original = new DomainEvent(
                eventId,
                "care.profile.updated",
                time,
                familyId,
                memberId,
                new DomainEvent.AuditInfo("care", "Updated profile", "Health Notes", "Old", "New"),
                new DomainEvent.NotificationInfo("care", "Profile shared", "/health", null),
                null,
                java.util.Map.of("noteCount", 3, "shared", true));

        String json = mapper.writeValueAsString(original);
        DomainEvent restored = mapper.readValue(json, DomainEvent.class);

        assertThat(restored.eventId()).isEqualTo(original.eventId());
        assertThat(restored.type()).isEqualTo(original.type());
        assertThat(restored.familyId()).isEqualTo(original.familyId());
        assertThat(restored.actorMemberId()).isEqualTo(original.actorMemberId());
        assertThat(restored.audit().category()).isEqualTo(original.audit().category());
        assertThat(restored.notification().message()).isEqualTo(original.notification().message());
        assertThat(restored.data().get("noteCount")).isEqualTo(3);
        assertThat(restored.data().get("shared")).isEqualTo(true);
    }
}
