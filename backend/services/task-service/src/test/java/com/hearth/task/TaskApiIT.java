package com.hearth.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.OutboxEvents;
import com.hearth.common.testing.TestFamilyConfig;
import com.hearth.task.application.TaskReminders;
import com.hearth.task.events.TaskEventListener;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

/** task-service against a real PostgreSQL. family-service is replaced by {@link FakeFamilyDirectory}; events are read from the outbox. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "hearth.outbox.relay=false",
        "hearth.consumer.enabled=true",
        "spring.kafka.listener.auto-startup=false",
        "hearth.reminders.poll-ms=3600000",
        "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false"
})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class TaskApiIT {

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
    TaskEventListener listener;

    @Autowired
    TaskReminders reminders;

    UUID afsara;
    UUID rafid;
    UUID kamal;
    UUID rahima;

    @BeforeEach
    void family() {
        jdbc.update("delete from outbox_event");
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        rafid = family.addMember("Rafid Mannan", "contributor");
        kamal = family.addMember("Kamal Mannan", "observer");
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
        return text.isBlank() ? null : json.readTree(text);
    }

    private Map<String, Object> task(String title, Instant start, UUID assignee, String visibility) {
        Map<String, Object> input = new HashMap<>();
        input.put("title", title);
        input.put("notes", "");
        input.put("category", "errands");
        input.put("priority", "important");
        input.put("start", start.toString());
        input.put("durationMin", 60);
        input.put("assigneeId", assignee == null ? null : assignee.toString());
        input.put("visibility", visibility);
        input.put("reminder", false);
        return input;
    }

    private static Instant inHours(int hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MINUTES);
    }

    @Test
    void aSharedTaskIsLoggedAndItsAssigneeIsAsked() throws Exception {
        JsonNode created = call(post("/api/v1/tasks"), task("  Buy rice  ", inHours(5), rafid, "family"), 201);
        assertThat(created.get("title").asText()).isEqualTo("Buy rice");
        assertThat(created.get("status").asText()).isEqualTo("scheduled");
        assertThat(created.get("assigneeId").asText()).isEqualTo(rafid.toString());
        assertThat(created.get("createdById").asText()).isEqualTo(afsara.toString());
        assertThat(created.has("forId")).isFalse();

        DomainEvent event = OutboxEvents.last(jdbc, json, EventTypes.TASK_CREATED);
        assertThat(event.audit().action()).isEqualTo("Created a task");
        assertThat(event.audit().after()).startsWith("Rafid Mannan · ");
        assertThat(event.notification().recipientId()).isEqualTo(rafid);
        assertThat(event.notification().message()).startsWith("Afsara asked you to do “Buy rice” (");

        family.signInAs(rafid);
        assertThat(call(get("/api/v1/tasks"), null, 200)).hasSize(1);
    }

    @Test
    void aPrivateTaskBelongsToItsWriterAndStaysOutOfTheFamilyLog() throws Exception {
        JsonNode created = call(post("/api/v1/tasks"), task("Therapy session", inHours(3), rafid, "private"), 201);
        assertThat(created.get("assigneeId").asText()).as("a private task is always the writer's").isEqualTo(afsara.toString());
        DomainEvent event = OutboxEvents.last(jdbc, json, EventTypes.TASK_CREATED);
        assertThat(event.audit()).isNull();
        assertThat(event.notification()).isNull();

        family.signInAs(rafid);
        assertThat(call(get("/api/v1/tasks"), null, 200)).isEmpty();
        call(get("/api/v1/tasks/" + created.get("id").asText()), null, 404);

        family.signInAs(afsara);
        JsonNode refused = call(put("/api/v1/tasks/" + created.get("id").asText() + "/assignee"), Map.of("memberId", rafid.toString()), 422);
        assertThat(refused.get("detail").asText()).contains("private task");
    }

    @Test
    void observersReadButCannotChangeAndInputIsChecked() throws Exception {
        family.signInAs(kamal);
        call(post("/api/v1/tasks"), task("Cook", inHours(2), null, "family"), 403);

        family.signInAs(afsara);
        Map<String, Object> bad = task("Cook", inHours(2), null, "family");
        bad.put("category", "space-travel");
        assertThat(call(post("/api/v1/tasks"), bad, 400).get("detail").asText()).isEqualTo("Choose what kind of task it is.");
        bad = task("Cook", inHours(2), UUID.randomUUID(), "family");
        call(post("/api/v1/tasks"), bad, 422);
        bad = task("Cook", inHours(2), null, "family");
        bad.put("durationMin", 3);
        call(post("/api/v1/tasks"), bad, 400);
        bad = task("Cook", inHours(2), null, "family");
        bad.put("forId", rahima.toString());
        assertThat(call(post("/api/v1/tasks"), bad, 201).get("forId").asText()).isEqualTo(rahima.toString());
    }

    @Test
    void completingReopeningCancellingAndHandingOver() throws Exception {
        String id = call(post("/api/v1/tasks"), task("Pick up medicine", inHours(4), null, "family"), 201).get("id").asText();

        JsonNode done = call(post("/api/v1/tasks/" + id + "/complete"), null, 200);
        assertThat(done.get("status").asText()).isEqualTo("completed");
        assertThat(done.get("completedById").asText()).isEqualTo(afsara.toString());
        JsonNode reopened = call(post("/api/v1/tasks/" + id + "/reopen"), null, 200);
        assertThat(reopened.has("completedAt")).isFalse();

        JsonNode handed = call(put("/api/v1/tasks/" + id + "/assignee"), Map.of("memberId", rafid.toString()), 200);
        assertThat(handed.get("assigneeId").asText()).isEqualTo(rafid.toString());
        DomainEvent assigned = OutboxEvents.last(jdbc, json, EventTypes.TASK_ASSIGNED);
        assertThat(assigned.audit().before()).isEqualTo("Unassigned");
        assertThat(assigned.audit().after()).isEqualTo("Rafid Mannan");

        call(delete("/api/v1/tasks/" + id), null, 204);
        assertThat(call(get("/api/v1/tasks"), null, 200)).isEmpty();
        assertThat(call(get("/api/v1/tasks?includeCancelled=true"), null, 200).get(0).get("status").asText()).isEqualTo("cancelled");
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.TASK_CANCELLED).uuid("taskId").toString()).isEqualTo(id);
    }

    @Test
    void makingASharedTaskPrivateIsAnnounced() throws Exception {
        Map<String, Object> input = task("Gym", inHours(6), afsara, "family");
        String id = call(post("/api/v1/tasks"), input, 201).get("id").asText();
        input.put("visibility", "private");
        call(put("/api/v1/tasks/" + id), input, 200);
        DomainEvent event = OutboxEvents.last(jdbc, json, EventTypes.TASK_MADE_PRIVATE);
        assertThat(event.audit()).isNull();
    }

    @Test
    void personalEventsAreTheOwnersAndBusyOnesHideTheirTitle() throws Exception {
        Map<String, Object> weekly = new HashMap<>(Map.of("title", "Data Structures", "kind", "class", "start", inHours(1).toString(), "durationMin", 90,
                "repeat", "weekly", "days", List.of(false, false, false, false, false, false, false), "location", "Room 402", "visibility", "busy"));
        assertThat(call(post("/api/v1/events"), weekly, 422).get("detail").asText()).isEqualTo("Choose at least one day of the week.");
        weekly.put("days", List.of(false, true, false, true, false, false, true));
        JsonNode event = call(post("/api/v1/events"), weekly, 201);
        assertThat(event.get("title").asText()).isEqualTo("Data Structures");

        family.signInAs(rafid);
        JsonNode seen = call(get("/api/v1/events?memberId=" + afsara), null, 200).get(0);
        assertThat(seen.get("title").asText()).isEqualTo("Busy");
        assertThat(seen.get("location").asText()).isEmpty();
        weekly.put("title", "Hijacked");
        call(put("/api/v1/events/" + event.get("id").asText()), weekly, 404);
        call(delete("/api/v1/events/" + event.get("id").asText()), null, 404);
        assertThat(call(get("/api/v1/events"), null, 200)).isEmpty();
    }

    @Test
    void reportingTimeAwayNamesTheSharedTasksThatNeedSomeoneElse() throws Exception {
        family.signInAs(rafid);
        String shared = call(post("/api/v1/tasks"), task("Drive Grandma", inHours(10), rafid, "family"), 201).get("id").asText();
        String personal = call(post("/api/v1/tasks"), task("Study", inHours(11), rafid, "private"), 201).get("id").asText();
        call(post("/api/v1/tasks"), task("Later thing", inHours(40), rafid, "family"), 201);

        call(post("/api/v1/unavailability"), Map.of("start", inHours(9).toString(), "end", inHours(9).toString(), "reason", "", "note", ""), 422);
        JsonNode result = call(post("/api/v1/unavailability"), Map.of("start", inHours(9).toString(), "end", inHours(13).toString(), "reason", "Sick", "note", " fever "), 201);
        assertThat(result.get("affectedTaskIds")).hasSize(1);
        assertThat(result.get("affectedTaskIds").get(0).asText()).isEqualTo(shared);
        assertThat(result.get("personalTaskIds").get(0).asText()).isEqualTo(personal);
        assertThat(result.get("requestIds")).isEmpty();
        assertThat(result.get("unavailability").get("note").asText()).isEqualTo("fever");

        DomainEvent event = OutboxEvents.last(jdbc, json, EventTypes.UNAVAILABILITY_REPORTED);
        assertThat(event.uuids("taskIds")).containsExactly(UUID.fromString(shared));
        assertThat(event.text("requestReason")).isEqualTo("Rafid is unavailable (sick).");
        assertThat(event.notification().message()).contains("1 task needs someone else");

        family.signInAs(afsara);
        assertThat(call(get("/api/v1/unavailability?memberId=" + rafid), null, 200)).hasSize(1);
    }

    @Test
    void decisionServiceSeesEveryonesTimeButNotWhatPrivateThingsAre() throws Exception {
        family.signInAs(rafid);
        call(post("/api/v1/tasks"), task("Doctor (private)", inHours(5), rafid, "private"), 201);

        family.signInAs(afsara);
        JsonNode planning = call(get("/api/v1/internal/planning"), null, 200);
        JsonNode privateTask = planning.get("tasks").get(0);
        assertThat(privateTask.get("title").asText()).isEmpty();
        assertThat(privateTask.get("assigneeId").asText()).isEqualTo(rafid.toString());

        String id = call(post("/api/v1/tasks"), task("Shared", inHours(6), null, "family"), 201).get("id").asText();
        JsonNode changed = call(put("/api/v1/internal/tasks/" + id + "/plan"), Map.of("changeAssignee", true, "assigneeId", rafid.toString(), "start", inHours(8).toString()), 200);
        assertThat(changed.get("assigneeId").asText()).isEqualTo(rafid.toString());
        call(post("/api/v1/internal/tasks/" + id + "/acknowledge"), Map.of("kind", "overlap"), 204);
        assertThat(call(get("/api/v1/tasks/" + id), null, 200).get("acknowledgedConflict").asText()).isEqualTo("overlap");
    }

    @Test
    void tasksFollowChangesMadeInOtherServices() throws Exception {
        family.signInAs(rafid);
        String rafidsPrivate = call(post("/api/v1/tasks"), task("Rafid's own", inHours(5), rafid, "private"), 201).get("id").asText();
        String rafidsShared = call(post("/api/v1/tasks"), task("Rafid's shared", inHours(6), rafid, "family"), 201).get("id").asText();
        family.signInAs(afsara);
        UUID appointment = UUID.randomUUID();
        Map<String, Object> linked = task("Drive to clinic", inHours(7), afsara, "family");
        linked.put("appointmentId", appointment.toString());
        String linkedId = call(post("/api/v1/tasks"), linked, 201).get("id").asText();

        listener.handle(Events.of(EventTypes.APPOINTMENT_UPDATED, family.familyId(), afsara).data("appointmentId", appointment).data("escortId", rafid).build());
        assertThat(call(get("/api/v1/tasks/" + linkedId), null, 200).get("assigneeId").asText()).isEqualTo(rafid.toString());

        listener.handle(Events.of(EventTypes.MEMBER_REMOVED, family.familyId(), afsara).data("memberId", rafid).build());
        assertThat(jdbc.queryForObject("select count(*) from task where id = ?::uuid", Integer.class, rafidsPrivate)).isZero();
        assertThat(call(get("/api/v1/tasks/" + rafidsShared), null, 200).get("assigneeId").isNull()).isTrue();

        listener.handle(Events.of(EventTypes.APPOINTMENT_REMOVED, family.familyId(), afsara).data("appointmentId", appointment).build());
        assertThat(call(get("/api/v1/tasks/" + linkedId), null, 200).has("appointmentId")).isFalse();
    }

    @Test
    void aReminderGoesOutOnceFifteenMinutesBefore() throws Exception {
        Map<String, Object> soon = task("Give medicine", Instant.now().plus(10, ChronoUnit.MINUTES), rafid, "family");
        soon.put("reminder", true);
        call(post("/api/v1/tasks"), soon, 201);
        Map<String, Object> later = task("Later", Instant.now().plus(2, ChronoUnit.HOURS), rafid, "family");
        later.put("reminder", true);
        call(post("/api/v1/tasks"), later, 201);

        reminders.raiseDueReminders();
        reminders.raiseDueReminders();
        List<DomainEvent> sent = OutboxEvents.ofType(jdbc, json, EventTypes.TASK_REMINDER);
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).notification().recipientId()).isEqualTo(rafid);
        assertThat(sent.get(0).notification().message()).matches("Give medicine — starts at \\d{1,2}:\\d{2} (AM|PM)\\.");
    }
}
