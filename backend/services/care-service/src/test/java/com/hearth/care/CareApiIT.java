package com.hearth.care;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.care.application.AppointmentReminders;
import com.hearth.care.events.CareEventListener;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.OutboxEvents;
import com.hearth.common.testing.TestFamilyConfig;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * care-service against real PostgreSQL and Neo4j. family-service is the fake directory; calls to other
 * services ({@link ServiceClient}) are stubbed; events are read from the outbox.
 */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "hearth.outbox.relay=false",
        "spring.kafka.listener.auto-startup=false",
        "hearth.reminders.poll-ms=3600000",
        "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false",
        "hearth.storage.dir=target/test-documents"
})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class CareApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    @ServiceConnection
    static Neo4jContainer<?> neo4j = new Neo4jContainer<>("neo4j:5-community").withoutAuthentication();

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    CareEventListener listener;

    @Autowired
    AppointmentReminders reminders;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID nazmun;
    UUID rafid;
    UUID rahima;

    @BeforeEach
    void family() {
        jdbc.update("delete from outbox_event");
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        nazmun = family.addMember("Nazmun Nahar", "contributor", List.of("meals"), new com.hearth.common.family.Availability(List.of(true, true, true, true, true, true, true), List.of()), true, false);
        rafid = family.addMember("Rafid Mannan", "contributor");
        rahima = family.addDependant("Rahima Khatun", "Grandmother");
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
        return text.isBlank() || !result.getResponse().getContentType().contains("json") ? null : json.readTree(text);
    }

    private Map<String, Object> appointment(String title, Instant start, UUID forId, UUID escortId, String visibility) {
        Map<String, Object> input = new HashMap<>();
        input.put("title", title);
        input.put("specialty", "Cardiology");
        input.put("start", start.toString());
        input.put("durationMin", 45);
        input.put("provider", "Dr. Karim");
        input.put("location", "Square Hospital");
        input.put("forId", forId.toString());
        input.put("escortId", escortId == null ? null : escortId.toString());
        input.put("visibility", visibility);
        input.put("prep", List.of("Bring reports", " ", "Fasting"));
        input.put("note", "");
        return input;
    }

    private static Map<String, Object> profile(List<String> conditions, List<Map<String, Object>> goals, List<String> avoid, boolean shared) {
        return Map.of("conditions", conditions, "goals", goals, "avoid", avoid, "preferences", List.of(), "notes", "", "shared", shared);
    }

    /* ───────── appointments ───────── */

    @Test
    void appointmentsAskTheEscortAndPrivateOnesStayWithThePeopleInvolved() throws Exception {
        Instant start = Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        JsonNode visit = call(post("/api/v1/appointments"), appointment("Heart check-up", start, rahima, rafid, "family"), 201);
        assertThat(visit.get("prep")).hasSize(2);
        DomainEvent created = OutboxEvents.last(jdbc, json, EventTypes.APPOINTMENT_CREATED);
        assertThat(created.audit().after()).startsWith("Rahima Khatun · ");
        assertThat(created.notification().recipientId()).isEqualTo(rafid);
        assertThat(created.notification().message()).startsWith("Afsara asked you to go along to “Heart check-up” with Rahima (");

        String id = visit.get("id").asText();
        String prepId = visit.get("prep").get(0).get("id").asText();
        JsonNode toggled = call(post("/api/v1/appointments/" + id + "/prep/" + prepId + "/toggle"), null, 200);
        assertThat(toggled.get("prep").get(0).get("done").asBoolean()).isTrue();
        assertThat(toggled.get("prep").get(0).get("doneById").asText()).isEqualTo(afsara.toString());
        assertThat(call(post("/api/v1/appointments/" + id + "/prep"), Map.of("label", "Insurance card"), 200).get("prep")).hasSize(3);
        assertThat(call(delete("/api/v1/appointments/" + id + "/prep/" + prepId), null, 200).get("prep")).hasSize(2);

        JsonNode secret = call(post("/api/v1/appointments"), appointment("Therapy", start, afsara, null, "private"), 201);
        family.signInAs(nazmun);
        assertThat(call(get("/api/v1/appointments"), null, 200)).hasSize(1);
        call(get("/api/v1/appointments/" + secret.get("id").asText()), null, 404);
        JsonNode planning = call(get("/api/v1/internal/appointments"), null, 200);
        assertThat(planning).hasSize(2);
        assertThat(planning.get(1).get("title").asText()).as("what a private visit is about stays hidden").isEmpty();

        call(post("/api/v1/appointments"), appointment("Nobody", start, UUID.randomUUID(), null, "family"), 422);
    }

    @Test
    void remindersGoToThePersonAndTheEscortOnce() throws Exception {
        call(post("/api/v1/appointments"), appointment("Dentist", Instant.now().plus(40, ChronoUnit.MINUTES), nazmun, rafid, "family"), 201);
        reminders.raiseDueReminders();
        reminders.raiseDueReminders();
        List<DomainEvent> sent = OutboxEvents.ofType(jdbc, json, EventTypes.APPOINTMENT_REMINDER);
        assertThat(sent).extracting(e -> e.notification().recipientId()).containsExactlyInAnyOrder(nazmun, rafid);
        assertThat(sent.get(0).notification().message()).matches("Dentist — appointment at \\d{1,2}:\\d{2} (AM|PM), Square Hospital\\.");
    }

    /* ───────── health notes & food ───────── */

    @Test
    void healthNotesFollowTheSharingRules() throws Exception {
        // Rafid keeps his notes private: Afsara (organiser, medical access) still cannot see them.
        family.signInAs(rafid);
        JsonNode own = call(put("/api/v1/health/profiles/" + rafid), profile(List.of("low-iron", "made-up"), List.of(), List.of(), false), 200);
        assertThat(own.get("conditions")).hasSize(1);
        family.signInAs(afsara);
        call(get("/api/v1/health/profiles/" + rafid), null, 403);
        call(put("/api/v1/health/profiles/" + rafid), profile(List.of(), List.of(), List.of(), false), 403);
        assertThat(call(get("/api/v1/health/profiles"), null, 200)).hasSize(1);

        // A dependant's notes: the organiser may edit; they are always shared; Rafid (no medical access) may not see them.
        JsonNode grandma = call(put("/api/v1/health/profiles/" + rahima), profile(List.of("high-blood-pressure"), List.of(Map.of("title", "Walk daily", "target", "", "tags", List.of())), List.of(), false), 200);
        assertThat(grandma.get("shared").asBoolean()).isTrue();
        assertThat(grandma.get("goals")).as("a goal without tags is dropped").isEmpty();
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.HEALTH_UPDATED).audit().subject()).isEqualTo("Rahima Khatun");
        family.signInAs(rafid);
        call(get("/api/v1/health/profiles/" + rahima), null, 403);

        // Nazmun has medical access: sees the dependant's notes, and Rafid's once he shares them.
        family.signInAs(rafid);
        call(put("/api/v1/health/profiles/" + rafid), profile(List.of("low-iron"), List.of(), List.of(), true), 200);
        family.signInAs(nazmun);
        assertThat(call(get("/api/v1/health/profiles"), null, 200)).hasSize(3);
    }

    @Test
    void foodSuggestionsMatchNotesSkipAvoidedFoodsAndKnowWhatIsOnTheList() throws Exception {
        call(put("/api/v1/health/profiles/" + afsara), profile(List.of("low-iron"), List.of(), List.of("spinach"), true), 200);
        call(put("/api/v1/health/profiles/" + rahima), profile(List.of("high-blood-pressure"), List.of(), List.of(), false), 200);

        JsonNode suggestions = call(get("/api/v1/health/suggestions"), null, 200);
        assertThat(suggestions.size()).isGreaterThan(3);
        assertThat(suggestions.findValuesAsText("id")).doesNotContain("spinach-for-afsara");
        for (JsonNode food : suggestions) {
            for (JsonNode reason : food.get("reasons")) {
                if (reason.get("personId").asText().equals(afsara.toString())) {
                    assertThat(food.get("name").asText().toLowerCase()).doesNotContain("spinach");
                }
            }
        }
        // Ordered: most reasons first.
        for (int i = 1; i < suggestions.size(); i++) {
            assertThat(suggestions.get(i - 1).get("reasons").size()).isGreaterThanOrEqualTo(suggestions.get(i).get("reasons").size());
        }
        String foodId = suggestions.get(0).get("id").asText();
        call(post("/api/v1/groceries/from-food"), Map.of("foodId", foodId, "forIds", List.of(rahima.toString()), "tags", List.of("iron")), 201);
        JsonNode again = call(get("/api/v1/health/suggestions?personId=" + rahima), null, 200);
        assertThat(again.findValues("onList").stream().anyMatch(JsonNode::asBoolean)).isTrue();
    }

    /* ───────── shopping list ───────── */

    @Test
    void theShoppingListNamesOnlyPeopleWhoShareAndBecomesOneTask() throws Exception {
        family.signInAs(nazmun);
        call(put("/api/v1/health/profiles/" + nazmun), profile(List.of(), List.of(), List.of(), false), 200);
        family.signInAs(afsara);
        JsonNode lentils = call(post("/api/v1/groceries/from-food"), Map.of("foodId", "lentils", "forIds", List.of(rahima.toString(), nazmun.toString()), "tags", List.of("iron", "calcium", "high-protein")), 201);
        assertThat(lentils.get("name").asText()).isEqualTo("Red lentils (Masoor dal)");
        assertThat(lentils.get("forIds")).hasSize(1);
        assertThat(lentils.get("reason").asText()).isEqualTo("Iron, High protein");
        JsonNode merged = call(post("/api/v1/groceries/from-food"), Map.of("foodId", "lentils", "forIds", List.of(afsara.toString()), "tags", List.of()), 201);
        assertThat(merged.get("id").asText()).isEqualTo(lentils.get("id").asText());
        call(post("/api/v1/groceries/from-food"), Map.of("foodId", "unicorn-meat", "forIds", List.of(), "tags", List.of()), 404);

        call(post("/api/v1/groceries"), Map.of("name", " ", "quantity", 1, "unit", ""), 422);
        JsonNode soap = call(post("/api/v1/groceries"), Map.of("name", "Soap", "quantity", 0, "unit", ""), 201);
        assertThat(soap.get("quantity").asInt()).isEqualTo(1);
        assertThat(soap.get("unit").asText()).isEqualTo("item");
        assertThat(call(patch("/api/v1/groceries/" + soap.get("id").asText()), Map.of("quantity", 3), 200).get("quantity").asInt()).isEqualTo(3);
        call(patch("/api/v1/groceries/" + soap.get("id").asText()), Map.of("status", "in-pantry"), 200);

        when(services.post(endsWith("/api/v1/tasks"), any(), eq(JsonNode.class))).thenReturn(json.readTree("{\"id\":\"t-1\",\"title\":\"Shopping (1 item)\"}"));
        Instant start = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        JsonNode task = call(post("/api/v1/groceries/task"), Map.of("assigneeId", rafid.toString(), "start", start.toString()), 201);
        assertThat(task.get("title").asText()).isEqualTo("Shopping (1 item)");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(services).post(endsWith("/api/v1/tasks"), sent.capture(), eq(JsonNode.class));
        assertThat(sent.getValue().get("notes")).isEqualTo("• Red lentils (Masoor dal) — 1 × 1 kg");
        assertThat(sent.getValue().get("assigneeId")).isEqualTo(rafid.toString());

        call(delete("/api/v1/groceries/" + lentils.get("id").asText()), null, 204);
        call(post("/api/v1/groceries/task"), Map.of("start", start.toString()), 422);
    }

    /* ───────── documents ───────── */

    @Test
    void documentsAreStoredAndRestrictedOnesStayWithTheNamedPeople() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "report.pdf", "application/pdf", "%PDF-1.4 test".getBytes());
        MvcResult uploaded = mvc.perform(multipart("/api/v1/documents").file(pdf).param("title", "Blood test").param("category", "Lab result")
                .param("ownerId", rahima.toString()).param("access", "restricted").param("allowedIds", nazmun.toString()).with(jwt())).andReturn();
        assertThat(uploaded.getResponse().getStatus()).isEqualTo(201);
        JsonNode doc = json.readTree(uploaded.getResponse().getContentAsString());
        assertThat(doc.get("allowedIds")).hasSize(2);
        String id = doc.get("id").asText();

        family.signInAs(rafid);
        assertThat(call(get("/api/v1/documents"), null, 200)).isEmpty();
        call(get("/api/v1/documents/" + id + "/file"), null, 404);
        family.signInAs(nazmun);
        MvcResult file = mvc.perform(get("/api/v1/documents/" + id + "/file").with(jwt())).andReturn();
        assertThat(file.getResponse().getContentAsString()).isEqualTo("%PDF-1.4 test");
        call(put("/api/v1/documents/" + id + "/access"), Map.of("access", "family", "allowedIds", List.of()), 403);

        family.signInAs(afsara);
        JsonNode shared = call(put("/api/v1/documents/" + id + "/access"), Map.of("access", "family", "allowedIds", List.of()), 200);
        assertThat(shared.get("access").asText()).isEqualTo("family");
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.DOCUMENT_ACCESS_CHANGED).audit().action()).isEqualTo("Shared a document with the family");

        MockMultipartFile exe = new MockMultipartFile("file", "virus.exe", "application/x-msdownload", new byte[] {1, 2});
        assertThat(mvc.perform(multipart("/api/v1/documents").file(exe).param("category", "Other").param("access", "family").with(jwt())).andReturn().getResponse().getStatus()).isEqualTo(415);
        call(delete("/api/v1/documents/" + id), null, 204);
    }

    /* ───────── family map ───────── */

    @Test
    void theFamilyMapIsBuiltInNeo4jAndOnlyRebuiltWhenSomethingChanges() throws Exception {
        Instant soon = Instant.now().plus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MINUTES);
        JsonNode visit = call(post("/api/v1/appointments"), appointment("Heart check-up", soon, rahima, rafid, "family"), 201);
        String taskId = UUID.randomUUID().toString();
        when(services.get(endsWith("/api/v1/family"), eq(JsonNode.class))).thenReturn(json.readTree("""
                {"id":"%s","name":"The Mannan Family","location":"Dhaka","dependants":[{"id":"%s","name":"Rahima Khatun","relation":"Grandmother","notes":""}]}
                """.formatted(family.familyId(), rahima)));
        when(services.get(endsWith("/api/v1/members"), eq(JsonNode.class))).thenReturn(json.readTree("""
                [{"id":"%s","name":"Afsara Mannan","relation":"Daughter","role":"lead","status":"active"},
                 {"id":"%s","name":"Rafid Mannan","relation":"Brother","role":"contributor","status":"active"}]
                """.formatted(afsara, rafid)));
        when(services.get(endsWith("/api/v1/tasks"), eq(JsonNode.class))).thenReturn(json.readTree("""
                [{"id":"%s","title":"Drive Grandma","start":"%s","status":"scheduled","visibility":"family","assigneeId":"%s","forId":"%s","appointmentId":"%s"},
                 {"id":"%s","title":"Private","start":"%s","status":"scheduled","visibility":"private","assigneeId":"%s"}]
                """.formatted(taskId, soon, rafid, rahima, visit.get("id").asText(), UUID.randomUUID(), soon, afsara)));

        JsonNode graph = call(get("/api/v1/caregraph"), null, 200);
        assertThat(graph.get("nodes").findValuesAsText("kind")).containsExactly("family", "member", "member", "dependant", "appointment", "task");
        assertThat(graph.get("nodes").get(0).get("label").asText()).isEqualTo("The Mannan Family");
        assertThat(graph.get("edges").findValuesAsText("label")).contains("does", "for Rahima", "needed for", "goes along", "member", "looked after");
        Integer relationships = neo4jCount("MATCH (:Member)-[:DOES]->(:Task) RETURN count(*) AS c");
        assertThat(relationships).isEqualTo(1);

        clearInvocations(services);
        call(get("/api/v1/caregraph"), null, 200);
        verify(services, times(0)).get(endsWith("/api/v1/tasks"), eq(JsonNode.class));

        listener.handle(Events.of(EventTypes.TASK_UPDATED, family.familyId(), afsara).data("taskId", taskId).build());
        call(get("/api/v1/caregraph"), null, 200);
        verify(services, times(1)).get(endsWith("/api/v1/tasks"), eq(JsonNode.class));
    }

    private Integer neo4jCount(String query) {
        try (org.neo4j.driver.Driver driver = org.neo4j.driver.GraphDatabase.driver(neo4j.getBoltUrl(), org.neo4j.driver.AuthTokens.none());
             org.neo4j.driver.Session session = driver.session()) {
            return session.run(query).single().get("c").asInt();
        }
    }

    /* ───────── changes made elsewhere ───────── */

    @Test
    void careDataFollowsPeopleLeavingAndHandovers() throws Exception {
        Instant start = Instant.now().plus(2, ChronoUnit.DAYS);
        JsonNode forRafid = call(post("/api/v1/appointments"), appointment("Rafid's check-up", start, rafid, null, "family"), 201);
        JsonNode escorted = call(post("/api/v1/appointments"), appointment("Grandma's visit", start, rahima, rafid, "family"), 201);
        family.signInAs(rafid);
        call(put("/api/v1/health/profiles/" + rafid), profile(List.of("low-iron"), List.of(), List.of(), true), 200);
        family.signInAs(afsara);

        listener.handle(Events.of(EventTypes.MEMBER_REMOVED, family.familyId(), afsara).data("memberId", rafid).build());
        call(get("/api/v1/appointments/" + forRafid.get("id").asText()), null, 404);
        assertThat(call(get("/api/v1/appointments/" + escorted.get("id").asText()), null, 200).get("escortId").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from health_profile where person_id = ?", Integer.class, rafid)).isZero();

        listener.handle(Events.of(EventTypes.HANDOVER_APPROVED, family.familyId(), afsara).data("appointmentId", escorted.get("id").asText()).data("memberId", nazmun).build());
        assertThat(call(get("/api/v1/appointments/" + escorted.get("id").asText()), null, 200).get("escortId").asText()).isEqualTo(nazmun.toString());
    }
}
