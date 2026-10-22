package com.hearth.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.Events;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.TestFamilyConfig;
import com.hearth.notification.events.NotificationEventListener;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** notification-service against a real PostgreSQL; events are fed straight to the listener. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {"spring.kafka.listener.auto-startup=false", "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false"})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class NotificationApiIT {

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
    NotificationEventListener listener;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID rafid;

    @BeforeEach
    void family() {
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        rafid = family.addMember("Rafid Mannan", "contributor");
        family.signInAs(afsara);
    }

    private JsonNode call(MockHttpServletRequestBuilder request, Object body, int expectedStatus) throws Exception {
        request.with(jwt());
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult result = mvc.perform(request).andReturn();
        String text = result.getResponse().getContentAsString();
        assertThat(result.getResponse().getStatus()).as("%s %s: %s", result.getRequest().getMethod(), result.getRequest().getRequestURI(), text).isEqualTo(expectedStatus);
        return text.isBlank() ? null : json.readTree(text);
    }

    @Test
    void peopleSeeFamilyNewsAboutOthersAndWhatIsAddressedToThem() throws Exception {
        DomainEvent byAfsara = Events.of("task.created", family.familyId(), afsara).notify("task", "A task was added.", "/tasks/1").build();
        listener.handle(byAfsara);
        listener.handle(byAfsara);
        listener.handle(Events.of("task.assigned", family.familyId(), afsara).notifyMember(rafid, "task", "Afsara asked you to do “Cook”.", "/tasks/2").build());
        listener.handle(Events.of("task.reminder", family.familyId(), null).notifyMember(afsara, "reminder", "Cook — starts at 5:00 PM.", "/tasks/2").build());

        JsonNode mine = call(get("/api/v1/notifications"), null, 200);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).get("type").asText()).isEqualTo("reminder");
        assertThat(mine.get(0).get("forId").asText()).isEqualTo(afsara.toString());

        family.signInAs(rafid);
        JsonNode his = call(get("/api/v1/notifications"), null, 200);
        assertThat(his).hasSize(2);
        assertThat(call(get("/api/v1/notifications/unread-count"), null, 200).get("unread").asInt()).isEqualTo(2);
        call(post("/api/v1/notifications/" + his.get(0).get("id").asText() + "/read"), null, 204);
        assertThat(call(get("/api/v1/notifications/unread-count"), null, 200).get("unread").asInt()).isEqualTo(1);
        call(post("/api/v1/notifications/read-all"), null, 204);
        assertThat(call(get("/api/v1/notifications/unread-count"), null, 200).get("unread").asInt()).isZero();
        call(delete("/api/v1/notifications/" + his.get(1).get("id").asText()), null, 204);
        assertThat(call(get("/api/v1/notifications"), null, 200)).hasSize(1);

        // Someone else's notification cannot be touched.
        family.signInAs(afsara);
        call(post("/api/v1/notifications/" + his.get(0).get("id").asText() + "/read"), null, 404);
    }

    @Test
    void theFamilyChatCountsWhatOthersWroteSinceYouLastLooked() throws Exception {
        call(post("/api/v1/messages"), Map.of("channel", "family", "text", "  "), 422);
        call(post("/api/v1/messages"), Map.of("channel", "family", "text", "x".repeat(1001)), 422);
        JsonNode first = call(post("/api/v1/messages"), Map.of("channel", "family", "text", " Dinner at 8? "), 201);
        assertThat(first.get("text").asText()).isEqualTo("Dinner at 8?");
        assertThat(call(get("/api/v1/messages/unread-count"), null, 200).get("unread").asInt()).as("your own message is not unread").isZero();

        listener.handle(Events.of("member.status-changed", family.familyId(), rafid).statusMessage(rafid, "In class until 2").build());
        listener.handle(Events.of("handover.approved", family.familyId(), rafid).systemMessage("Rafid took over “Cook”.").build());
        assertThat(call(get("/api/v1/messages/unread-count"), null, 200).get("unread").asInt()).as("status counts, system lines do not").isEqualTo(1);

        JsonNode all = call(get("/api/v1/messages?channel=family"), null, 200);
        assertThat(all.findValuesAsText("kind")).containsExactly("text", "status", "system");
        assertThat(all.get(2).get("authorId").isNull()).isTrue();
        JsonNode newer = call(get("/api/v1/messages?channel=family&after=" + all.get(0).get("createdAt").asText()), null, 200);
        assertThat(newer).hasSize(2);

        call(post("/api/v1/messages/read"), Map.of("channel", "family"), 204);
        assertThat(call(get("/api/v1/messages/unread-count"), null, 200).get("unread").asInt()).isZero();
    }

    @Test
    void aTaskThreadIsOnlyOpenToPeopleWhoCanSeeTheTask() throws Exception {
        UUID visible = UUID.randomUUID();
        UUID hidden = UUID.randomUUID();
        when(services.get(endsWith("/api/v1/tasks/" + visible), eq(JsonNode.class))).thenReturn(json.createObjectNode());
        when(services.get(endsWith("/api/v1/tasks/" + hidden), eq(JsonNode.class))).thenThrow(ApiException.notFound("That task"));
        when(services.get(contains("/api/v1/tasks?includeCancelled=true"), eq(JsonNode.class))).thenReturn(json.readTree("[{\"id\":\"" + visible + "\"}]"));

        call(post("/api/v1/messages"), Map.of("channel", "task:" + visible, "text", "I'll pick up the medicine."), 201);
        call(post("/api/v1/messages"), Map.of("channel", "task:" + hidden, "text", "Snooping"), 404);
        call(get("/api/v1/messages?channel=task:" + hidden), null, 404);
        call(get("/api/v1/messages?channel=task:not-an-id"), null, 404);

        JsonNode counts = call(get("/api/v1/messages/task-counts"), null, 200);
        assertThat(counts.get(visible.toString()).asInt()).isEqualTo(1);
        assertThat(counts.has(hidden.toString())).isFalse();
    }
}
