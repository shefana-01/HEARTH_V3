package com.hearth.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.TestFamilyConfig;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Calendar sync against a real PostgreSQL: the private address, what the calendar contains, revoking it. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "hearth.outbox.relay=false", "spring.kafka.listener.auto-startup=false", "hearth.reminders.poll-ms=3600000",
        "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false", "hearth.app-url=https://hearth.example"
})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class CalendarApiIT {

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

    UUID afsara;
    UUID rafid;

    @BeforeEach
    void family() {
        jdbc.update("delete from calendar_feed");
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

    /** What a calendar app does: no token, no session. */
    private MvcResult fetch(String token, String ifNoneMatch) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/calendar/feeds/" + token + ".ics");
        if (ifNoneMatch != null) {
            request.header("If-None-Match", ifNoneMatch);
        }
        return mvc.perform(request).andReturn();
    }

    private Map<String, Object> task(String title, Instant start, UUID assignee, String visibility, boolean reminder) {
        Map<String, Object> input = new HashMap<>();
        input.put("title", title);
        input.put("notes", "Bring the card; and the list");
        input.put("category", "errands");
        input.put("priority", "important");
        input.put("start", start.toString());
        input.put("durationMin", 45);
        input.put("assigneeId", assignee == null ? null : assignee.toString());
        input.put("visibility", visibility);
        input.put("reminder", reminder);
        return input;
    }

    @Test
    void myCalendarHasMyTasksEventsAndTimeAwayButNothingOfOthers() throws Exception {
        Instant tomorrow = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        call(post("/api/v1/tasks"), task("Buy medicine, rice", tomorrow, afsara, "family", true), 201);
        call(post("/api/v1/tasks"), task("Diary", tomorrow.plus(2, ChronoUnit.HOURS), afsara, "private", false), 201);
        call(post("/api/v1/tasks"), task("Rafid's errand", tomorrow, rafid, "family", false), 201);
        ZoneId dhaka = ZoneId.of("Asia/Dhaka");
        LocalDate nextMonday = LocalDate.now(dhaka).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        Map<String, Object> event = new HashMap<>();
        event.put("title", "Compiler design");
        event.put("kind", "class");
        event.put("start", ZonedDateTime.of(nextMonday, LocalTime.of(10, 0), dhaka).toInstant().toString());
        event.put("durationMin", 90);
        event.put("repeat", "weekly");
        event.put("days", List.of(true, false, true, false, false, false, false));
        event.put("location", "Room 501");
        event.put("visibility", "details");
        call(post("/api/v1/events"), event, 201);
        call(post("/api/v1/unavailability"), Map.of("start", tomorrow.plus(5, ChronoUnit.DAYS).toString(), "end", tomorrow.plus(6, ChronoUnit.DAYS).toString(), "reason", "Travel", "note", ""), 201);

        assertThat(call(get("/api/v1/calendar/feed"), null, 200).get("active").asBoolean()).isFalse();
        JsonNode created = call(post("/api/v1/calendar/feed"), null, 201);
        String token = created.get("token").asText();
        assertThat(token).hasSize(43);
        assertThat(call(get("/api/v1/calendar/feed"), null, 200).has("token")).isFalse();
        assertThat(jdbc.queryForObject("select token_hash from calendar_feed", String.class)).hasSize(64).doesNotContain(token);

        MvcResult result = fetch(token, null);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentType()).startsWith("text/calendar");
        String ics = result.getResponse().getContentAsString();
        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).contains("X-WR-CALNAME:Hearth – Afsara", "SUMMARY:Buy medicine\\, rice", "Bring the card\\; and the list", "TRIGGER:-PT15M",
                "SUMMARY:Diary", "CLASS:PRIVATE", "SUMMARY:Compiler design", "LOCATION:Room 501", "SUMMARY:Away: Travel", "URL:https://hearth.example/tasks/");
        assertThat(ics).doesNotContain("Rafid's errand");
        // A class on Monday and Wednesday every week: about 52 occurrences over the next 180 days.
        long classes = ics.lines().filter(l -> l.equals("SUMMARY:Compiler design")).count();
        assertThat(classes).isBetween(48L, 53L);

        String etag = result.getResponse().getHeader("ETag");
        assertThat(fetch(token, etag).getResponse().getStatus()).isEqualTo(304);
        assertThat(call(get("/api/v1/calendar/feed"), null, 200).get("lastFetchedAt").isNull()).isFalse();
    }

    @Test
    void aNewAddressReplacesTheOldOneAndSwitchingOffEndsIt() throws Exception {
        String first = call(post("/api/v1/calendar/feed"), null, 201).get("token").asText();
        String second = call(post("/api/v1/calendar/feed"), null, 201).get("token").asText();
        assertThat(fetch(first, null).getResponse().getStatus()).isEqualTo(404);
        assertThat(fetch(second, null).getResponse().getStatus()).isEqualTo(200);

        call(delete("/api/v1/calendar/feed"), null, 204);
        assertThat(fetch(second, null).getResponse().getStatus()).isEqualTo(404);
        assertThat(fetch("short", null).getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    void theRestOfTheApiStillNeedsSigningIn() throws Exception {
        assertThat(mvc.perform(get("/api/v1/calendar/feed")).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/tasks")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
