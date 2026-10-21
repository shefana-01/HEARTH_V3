package com.hearth.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.audit.events.AuditEventListener;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.Events;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.TestFamilyConfig;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** audit-service against a real PostgreSQL; events are fed straight to the listener. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {"spring.kafka.listener.auto-startup=false", "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false"})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class AuditApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    AuditEventListener listener;

    @Test
    void eachFamilySeesItsOwnLogOnceNewestFirst() throws Exception {
        family.reset();
        UUID afsara = family.addMember("Afsara Mannan", "lead");
        DomainEvent created = Events.of("task.created", family.familyId(), afsara).audit("tasks", "Created a task", "Buy rice", null, "Rafid Mannan · Mon, Oct 19, 5:00 PM").build();
        listener.handle(created);
        listener.handle(created);
        listener.handle(Events.of("task.completed", family.familyId(), afsara).audit("tasks", "Completed a task", "Buy rice").build());
        listener.handle(Events.of("task.created", family.familyId(), afsara).build());
        listener.handle(Events.of("task.created", UUID.randomUUID(), UUID.randomUUID()).audit("tasks", "Created a task", "Another family's").build());

        JsonNode log = json.readTree(mvc.perform(get("/api/v1/audit-events").with(jwt())).andReturn().getResponse().getContentAsString());
        assertThat(log).hasSize(2);
        assertThat(log.get(0).get("action").asText()).isEqualTo("Completed a task");
        assertThat(log.get(0).has("before")).isFalse();
        assertThat(log.get(1).get("after").asText()).isEqualTo("Rafid Mannan · Mon, Oct 19, 5:00 PM");
        assertThat(log.get(1).get("actorId").asText()).isEqualTo(afsara.toString());
        assertThat(mvc.perform(get("/api/v1/audit-events")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
