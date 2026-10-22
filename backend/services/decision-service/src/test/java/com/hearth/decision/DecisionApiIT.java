package com.hearth.decision;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.family.Availability;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.OutboxEvents;
import com.hearth.common.testing.TestFamilyConfig;
import com.hearth.decision.events.DecisionEventListener;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * decision-service against a real PostgreSQL. The family is the fake directory; task-service and
 * care-service answers are stubbed with a small known plan, so the engine's results can be checked.
 */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {"hearth.outbox.relay=false", "spring.kafka.listener.auto-startup=false", "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false"})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class DecisionApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    DecisionEventListener listener;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID rafid;
    UUID nazmun;
    UUID rahima;
    ArrayNode tasks;
    ArrayNode events;
    ArrayNode away;
    ArrayNode appointments;
    Instant now = Instant.now().truncatedTo(ChronoUnit.MINUTES);

    @BeforeEach
    void plan() {
        jdbc.update("delete from outbox_event");
        jdbc.update("delete from reassignment_request");
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        rafid = family.addMember("Rafid Mannan", "contributor", List.of("driving", "errands"), new Availability(List.of(true, true, true, true, true, true, true), List.of()), false, false);
        nazmun = family.addMember("Nazmun Nahar", "contributor", List.of("meals"), new Availability(List.of(true, true, true, true, true, true, true), List.of()), true, false);
        rahima = family.addDependant("Rahima Khatun", "Grandmother");
        family.signInAs(afsara);
        tasks = json.createArrayNode();
        events = json.createArrayNode();
        away = json.createArrayNode();
        appointments = json.createArrayNode();
        when(services.get(endsWith("/api/v1/internal/planning"), eq(JsonNode.class))).thenAnswer(i -> json.createObjectNode().<ObjectNode>set("tasks", tasks).<ObjectNode>set("events", events).set("unavailability", away));
        when(services.get(endsWith("/api/v1/internal/appointments"), eq(JsonNode.class))).thenAnswer(i -> appointments);
    }

    private UUID task(String title, int startsInMinutes, UUID assignee, String visibility, String category) {
        UUID id = UUID.randomUUID();
        ObjectNode t = tasks.addObject();
        t.put("id", id.toString());
        t.put("title", visibility.equals("private") && !afsara.equals(assignee) ? "" : title);
        t.put("notes", "");
        t.put("category", category);
        t.put("priority", "important");
        t.put("status", "scheduled");
        t.put("start", now.plus(startsInMinutes, ChronoUnit.MINUTES).toString());
        t.put("durationMin", 60);
        if (assignee == null) {
            t.putNull("assigneeId");
        } else {
            t.put("assigneeId", assignee.toString());
        }
        t.put("visibility", visibility);
        t.put("createdById", (assignee == null ? afsara : assignee).toString());
        t.put("createdAt", now.toString());
        t.put("reminder", false);
        return id;
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
    void myDayRanksTheCallersTasksAndExplainsThem() throws Exception {
        task("Give medicine", 30, afsara, "family", "medication");
        task("Study", 26 * 60, afsara, "private", "study");
        task("Rafid's thing", 60, rafid, "family", "errands");

        JsonNode day = call(get("/api/v1/decisions/my-day"), null, 200);
        assertThat(day).hasSize(2);
        assertThat(day.get(0).get("task").get("title").asText()).isEqualTo("Give medicine");
        assertThat(day.get(0).get("advice").asText()).isEqualTo("now");
        assertThat(day.get(0).get("rank").asInt()).isEqualTo(1);
        assertThat(day.get(0).get("priority").get("explanation").asText()).contains("it matters for someone’s health or safety");
        assertThat(day.get(1).get("advice").asText()).isEqualTo("later");
    }

    @Test
    void attentionListsSharedClashesWithTheBestPersonToAsk() throws Exception {
        UUID unassigned = task("Drive Grandma", 120, null, "family", "transport");
        // Rafid's own private task, at another time: its clashes are his business, not the family's list.
        task("Rafid's private", 600, null, "family", "other");
        ((ObjectNode) tasks.get(1)).put("visibility", "private").put("assigneeId", rafid.toString()).put("title", "");

        JsonNode attention = call(get("/api/v1/decisions/attention"), null, 200);
        assertThat(attention).hasSize(1);
        assertThat(attention.get(0).get("task").get("id").asText()).isEqualTo(unassigned.toString());
        assertThat(attention.get(0).get("conflict").get("kind").asText()).isEqualTo("unassigned");
        assertThat(attention.get(0).get("topCandidate").get("memberId").asText()).isEqualTo(rafid.toString());
        assertThat(attention.get(0).has("openRequestId")).isFalse();

        JsonNode insight = call(get("/api/v1/decisions/tasks/" + unassigned + "/insight"), null, 200);
        assertThat(insight.get("candidates")).hasSize(3);
        assertThat(insight.get("candidates").get(0).get("reasons").toString()).contains("Can help with driving.");
    }

    @Test
    void privateTasksOfOthersAreNotFound() throws Exception {
        UUID secret = task("Therapy", 120, rafid, "private", "health");
        call(get("/api/v1/decisions/tasks/" + secret + "/insight"), null, 404);
        call(post("/api/v1/decisions/simulations"), Map.of("taskId", secret.toString(), "start", now.plus(1, ChronoUnit.DAYS).toString()), 404);
        call(post("/api/v1/reassignment-requests"), Map.of("taskId", secret.toString(), "reason", "x"), 404);
    }

    @Test
    void aHandoverIsRequestedOnceAndSettledBySomeoneWhoMay() throws Exception {
        UUID drive = task("Drive Grandma", 180, rafid, "family", "transport");
        ((ObjectNode) tasks.get(0)).put("appointmentId", UUID.randomUUID().toString());

        JsonNode request = call(post("/api/v1/reassignment-requests"), Map.of("taskId", drive.toString(), "reason", "Rafid has an exam", "note", ""), 201);
        JsonNode again = call(post("/api/v1/reassignment-requests"), Map.of("taskId", drive.toString(), "reason", "again", "note", ""), 201);
        assertThat(again.get("id").asText()).isEqualTo(request.get("id").asText());
        assertThat(request.get("fromMemberId").asText()).isEqualTo(rafid.toString());
        DomainEvent asked = OutboxEvents.last(jdbc, json, EventTypes.HANDOVER_REQUESTED);
        assertThat(asked.notification().message()).isEqualTo("“Drive Grandma” needs someone else. Can you take it?");

        JsonNode list = call(get("/api/v1/reassignment-requests"), null, 200);
        assertThat(list.get(0).get("taskTitle").asText()).isEqualTo("Drive Grandma");
        assertThat(list.get(0).get("status").asText()).isEqualTo("open");

        JsonNode detail = call(get("/api/v1/reassignment-requests/" + request.get("id").asText()), null, 200);
        assertThat(detail.get("candidates").findValuesAsText("memberId")).doesNotContain(rafid.toString());

        // Nazmun may volunteer herself but not hand it to someone else.
        family.signInAs(nazmun);
        call(post("/api/v1/reassignment-requests/" + request.get("id").asText() + "/approve"), Map.of("memberId", afsara.toString()), 403);
        call(post("/api/v1/reassignment-requests/" + request.get("id").asText() + "/approve"), Map.of("memberId", nazmun.toString()), 200);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> plan = ArgumentCaptor.forClass(Map.class);
        verify(services).put(endsWith("/api/v1/internal/tasks/" + drive + "/plan"), plan.capture(), eq(Void.class));
        assertThat(plan.getValue()).containsEntry("assigneeId", nazmun.toString());

        DomainEvent approved = OutboxEvents.last(jdbc, json, EventTypes.HANDOVER_APPROVED);
        assertThat(approved.chat().text()).isEqualTo("Nazmun took over “Drive Grandma” from Rafid.");
        assertThat(approved.audit().before()).isEqualTo("Rafid Mannan");
        assertThat(approved.uuid("appointmentId")).isNotNull();
        call(post("/api/v1/reassignment-requests/" + request.get("id").asText() + "/approve"), Map.of("memberId", nazmun.toString()), 409);
    }

    @Test
    void timeAwayOpensRequestsAndCancellingTheTaskClosesThem() throws Exception {
        UUID a = task("Cook dinner", 300, rafid, "family", "meals");
        UUID b = task("Buy rice", 360, rafid, "family", "errands");
        DomainEvent reported = Events.of(EventTypes.UNAVAILABILITY_REPORTED, family.familyId(), rafid)
                .data("memberId", rafid).data("taskIds", List.of(a, b)).data("requestReason", "Rafid is unavailable (sick).").data("note", "fever").build();
        listener.handle(reported);
        listener.handle(reported);
        JsonNode list = call(get("/api/v1/reassignment-requests"), null, 200);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("reason").asText()).isEqualTo("Rafid is unavailable (sick).");

        listener.handle(Events.of(EventTypes.TASK_CANCELLED, family.familyId(), afsara).data("taskId", a).build());
        assertThat(call(get("/api/v1/reassignment-requests"), null, 200).findValuesAsText("status")).containsExactlyInAnyOrder("open", "cancelled");
    }

    @Test
    void whatIfShowsTheEffectAndApplyingItSettlesTheOpenRequest() throws Exception {
        UUID unassigned = task("Drive Grandma", 240, null, "family", "transport");
        call(post("/api/v1/decisions/simulations"), Map.of("start", now.toString()), 400);
        JsonNode result = call(post("/api/v1/decisions/simulations"), Map.of("taskId", unassigned.toString(), "assigneeId", rafid.toString()), 200);
        assertThat(result.get("resolved").get(0).get("kind").asText()).isEqualTo("unassigned");
        assertThat(result.get("change").get("assigneeId").asText()).isEqualTo(rafid.toString());

        call(post("/api/v1/reassignment-requests"), Map.of("taskId", unassigned.toString(), "reason", "Needs a driver", "note", ""), 201);
        when(services.put(endsWith("/plan"), any(), eq(JsonNode.class))).thenReturn(json.readTree("{\"id\":\"" + unassigned + "\"}"));
        call(post("/api/v1/decisions/simulations/apply"), Map.of("taskId", unassigned.toString(), "assigneeId", rafid.toString()), 200);
        assertThat(call(get("/api/v1/reassignment-requests"), null, 200).get(0).get("status").asText()).isEqualTo("approved");
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.PLAN_CHANGED).audit().after()).startsWith("Rafid Mannan · ");

        UUID mine = task("My study", 300, afsara, "private", "study");
        call(post("/api/v1/decisions/simulations/apply"), Map.of("taskId", mine.toString(), "assigneeId", rafid.toString()), 422);
    }

    @Test
    void keepingAClashTellsTaskServiceWhichKind() throws Exception {
        UUID unassigned = task("Drive Grandma", 240, null, "family", "transport");
        call(post("/api/v1/decisions/tasks/" + unassigned + "/acknowledge"), null, 204);
        verify(services).post(endsWith("/api/v1/internal/tasks/" + unassigned + "/acknowledge"), eq(Map.of("kind", "unassigned")), eq(Void.class));
        UUID fine = task("Nothing wrong", 240, afsara, "family", "other");
        call(post("/api/v1/decisions/tasks/" + fine + "/acknowledge"), null, 204);
        verify(services, never()).post(endsWith("/api/v1/internal/tasks/" + fine + "/acknowledge"), any(), eq(Void.class));
    }

    @Test
    void theWeekShowsOthersPrivateTimeAsBusy() throws Exception {
        task("Rafid's private", 120, rafid, "private", "other");
        task("Shared one", 180, nazmun, "family", "meals");
        ObjectNode visit = appointments.addObject();
        visit.put("id", UUID.randomUUID().toString());
        visit.put("title", "Heart check-up");
        visit.put("start", now.plus(4, ChronoUnit.HOURS).toString());
        visit.put("durationMin", 45);
        visit.put("forId", rahima.toString());
        visit.put("escortId", nazmun.toString());
        visit.put("visibility", "family");
        visit.put("createdById", afsara.toString());
        visit.put("provider", "Dr. Karim");
        ObjectNode event = events.addObject();
        event.put("id", UUID.randomUUID().toString());
        event.put("memberId", rafid.toString());
        event.put("title", "Busy");
        event.put("start", now.plus(5, ChronoUnit.HOURS).toString());
        event.put("durationMin", 60);
        event.put("repeat", "none");
        event.set("days", json.valueToTree(List.of(false, false, false, false, false, false, false)));
        event.put("visibility", "busy");

        JsonNode week = call(get("/api/v1/schedule/events?from=" + now.minus(1, ChronoUnit.DAYS) + "&to=" + now.plus(6, ChronoUnit.DAYS)), null, 200);
        assertThat(week.findValuesAsText("kind")).containsExactly("busy", "task", "appointment", "busy");
        assertThat(week.get(1).get("subtitle").asText()).isEqualTo("Nazmun");
        assertThat(week.get(2).get("subtitle").asText()).isEqualTo("For Rahima · Dr. Karim");
        assertThat(week.get(2).get("memberId").asText()).isEqualTo(nazmun.toString());
        assertThat(week.get(0).has("href")).isFalse();
        call(get("/api/v1/schedule/events?from=" + now + "&to=" + now.minus(1, ChronoUnit.DAYS)), null, 422);
    }
}
