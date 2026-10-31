package com.hearth.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.ai.client.StubAiProvider;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.TestFamilyConfig;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** ai-service against a real PostgreSQL and a stub of the AI provider; other Hearth services are mocked. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "spring.kafka.bootstrap-servers=localhost:1",
        "hearth.ai.api-key=test-key",
        "hearth.ai.daily-requests-per-member=3",
        "hearth.ai.timeout=5s"
})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class AiApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    static final StubAiProvider provider = create();

    @DynamicPropertySource
    static void providerUrl(DynamicPropertyRegistry registry) {
        registry.add("hearth.ai.base-url", provider::url);
    }

    @AfterAll
    static void stop() {
        provider.close();
    }

    private static StubAiProvider create() {
        try {
            return new StubAiProvider();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID rafid;
    UUID dadu;

    @BeforeEach
    void family() {
        provider.reset();
        jdbc.update("delete from ai_usage");
        jdbc.update("delete from ai_consent");
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        rafid = family.addMember("Rafid Mannan", "contributor");
        dadu = family.addDependant("Dadu Mannan", "Grandfather");
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

    private void consent() throws Exception {
        call(put("/api/v1/ai/consent"), Map.of("granted", true), 200);
    }

    @Test
    void nothingIsSentUntilThePersonTurnsAiHelpOn() throws Exception {
        JsonNode status = call(get("/api/v1/ai/status"), null, 200);
        assertThat(status.get("enabled").asBoolean()).isTrue();
        assertThat(status.get("consented").asBoolean()).isFalse();

        call(post("/api/v1/ai/quick-add"), Map.of("text", "Buy rice tomorrow"), 403);
        assertThat(provider.received()).isEmpty();

        assertThat(call(put("/api/v1/ai/consent"), Map.of("granted", true), 200).get("consented").asBoolean()).isTrue();
        assertThat(call(put("/api/v1/ai/consent"), Map.of("granted", false), 200).get("consented").asBoolean()).isFalse();
        call(post("/api/v1/ai/quick-add"), Map.of("text", "Buy rice tomorrow"), 403);
        assertThat(provider.received()).isEmpty();
    }

    @Test
    void aSentenceBecomesDraftsAndOnlyFirstNamesLeaveHearth() throws Exception {
        consent();
        java.time.LocalDate day = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Dhaka")).plusDays(30);
        provider.replyWithTool("create_task_drafts", """
                {"drafts":[{"title":"Take Dadu to the dentist","notes":"","category":"health","priority":"important","date":"%s","time":"16:00",
                  "durationMin":90,"assignee":"m2","forPerson":"d1","visibility":"family","reminder":true}],"assumptions":["Rafid drives."]}
                """.formatted(day));

        JsonNode result = call(post("/api/v1/ai/quick-add"), Map.of("text", "Dadu dentist in a month at 4pm, Rafid drives"), 200);

        JsonNode draft = result.get("drafts").get(0);
        assertThat(draft.get("assigneeId").asText()).isEqualTo(rafid.toString());
        assertThat(draft.get("forId").asText()).isEqualTo(dadu.toString());
        assertThat(draft.get("start").asText()).isEqualTo(day.atTime(16, 0).atZone(java.time.ZoneId.of("Asia/Dhaka")).toInstant().toString());
        assertThat(result.get("assumptions").get(0).asText()).isEqualTo("Rafid drives.");

        StubAiProvider.Received sent = provider.received().get(0);
        assertThat(sent.authorization()).isEqualTo("Bearer test-key");
        JsonNode body = json.readTree(sent.body());
        assertThat(body.get("tool_choice").get("function").get("name").asText()).isEqualTo("create_task_drafts");
        assertThat(sent.body()).contains("Dadu dentist", "m2: Rafid", "d1: Dadu")
                .doesNotContain(afsara.toString(), rafid.toString(), dadu.toString(), "Mannan");

        JsonNode status = call(get("/api/v1/ai/status"), null, 200);
        assertThat(status.get("usedToday").asInt()).isEqualTo(1);
    }

    @Test
    void observersCannotCreateTasksWithAi() throws Exception {
        UUID nanu = family.addMember("Nanu Begum", "observer");
        family.signInAs(nanu);
        consent();
        call(post("/api/v1/ai/quick-add"), Map.of("text", "Buy rice"), 403);
        assertThat(provider.received()).isEmpty();
    }

    @Test
    void theDailyAllowanceIsEnforced() throws Exception {
        consent();
        for (int i = 0; i < 3; i++) {
            provider.replyWithText("Hi Rafid, could you pick up the medicine today? Thank you!");
            call(post("/api/v1/ai/drafts"), Map.of("kind", "chat-message", "points", "medicine pickup"), 200);
        }
        call(post("/api/v1/ai/drafts"), Map.of("kind", "chat-message", "points", "medicine pickup"), 429);
        assertThat(provider.received()).hasSize(3);
    }

    @Test
    void providerFailuresBecomeAFriendly503() throws Exception {
        consent();
        provider.replyWithStatus(500).replyWithStatus(500);
        JsonNode problem = call(post("/api/v1/ai/drafts"), Map.of("kind", "chat-message", "points", "hello"), 503);
        assertThat(problem.get("detail").asText()).contains("AI help could not answer");
        assertThat(provider.received()).hasSize(2);
        assertThat(call(get("/api/v1/ai/status"), null, 200).get("usedToday").asInt()).isZero();
    }

    @Test
    void aPlanIsCheckedByTheEngineBeforeItIsShown() throws Exception {
        consent();
        UUID cook = UUID.randomUUID();
        String start = java.time.Instant.now().plusSeconds(3 * 3600).toString();
        when(services.get(endsWith("/decisions/my-day"), eq(JsonNode.class))).thenReturn(json.readTree("""
                [{"task":{"id":"%s","title":"Cook dinner","category":"meals","priority":"routine","status":"scheduled","start":"%s","durationMin":60,"assigneeId":"%s","visibility":"family"},
                  "rank":1,"priority":{"score":55},"advice":"now","conflict":{"kind":"overlap"}}]
                """.formatted(cook, start, afsara)));
        when(services.get(endsWith("/decisions/attention"), eq(JsonNode.class))).thenReturn(json.readTree("""
                [{"task":{"id":"%s","title":"Cook dinner","category":"meals","priority":"routine","status":"scheduled","start":"%s","durationMin":60,"assigneeId":"%s","visibility":"family"},
                  "conflict":{"kind":"overlap"},"priority":{"score":55},"topCandidate":{"memberId":"%s","score":90}}]
                """.formatted(cook, start, afsara, rafid)));
        when(services.post(endsWith("/decisions/simulations"), anyMap(), eq(JsonNode.class))).thenReturn(json.readTree("{\"resolved\":[{\"id\":\"c1\"}],\"introduced\":[]}"));
        provider.replyWithTool("propose_plan", """
                {"summary":"One clash today.","suggestions":[{"task":"t1","action":"hand_over","to":"m2","reason":"Rafid is free this evening."}]}
                """);

        JsonNode plan = call(post("/api/v1/ai/plan"), null, 200);

        assertThat(plan.get("summary").asText()).isEqualTo("One clash today.");
        JsonNode suggestion = plan.get("suggestions").get(0);
        assertThat(suggestion.get("action").asText()).isEqualTo("hand-over");
        assertThat(suggestion.get("taskId").asText()).isEqualTo(cook.toString());
        assertThat(suggestion.get("assigneeId").asText()).isEqualTo(rafid.toString());
        assertThat(suggestion.get("resolves").asInt()).isEqualTo(1);
    }

    @Test
    void anEmptyWeekCostsNothing() throws Exception {
        consent();
        when(services.get(endsWith("/decisions/my-day"), eq(JsonNode.class))).thenReturn(json.readTree("[]"));
        when(services.get(endsWith("/decisions/attention"), eq(JsonNode.class))).thenReturn(json.readTree("[]"));
        JsonNode plan = call(post("/api/v1/ai/plan"), null, 200);
        assertThat(plan.get("suggestions")).isEmpty();
        assertThat(provider.received()).isEmpty();
    }
}
