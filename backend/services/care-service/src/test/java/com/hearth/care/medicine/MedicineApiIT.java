package com.hearth.care.medicine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.care.events.CareEventListener;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.family.Availability;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.OutboxEvents;
import com.hearth.common.testing.TestFamilyConfig;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Medicines and the emergency card against real PostgreSQL, with a clock the test moves. */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "hearth.outbox.relay=false", "spring.kafka.listener.auto-startup=false", "hearth.reminders.poll-ms=3600000",
        "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false", "hearth.storage.dir=target/test-documents"
})
@AutoConfigureMockMvc
@Import({TestFamilyConfig.class, MedicineApiIT.Clocks.class})
class MedicineApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    @ServiceConnection
    static Neo4jContainer<?> neo4j = new Neo4jContainer<>("neo4j:5-community").withoutAuthentication();

    static final ZoneId DHAKA = ZoneId.of("Asia/Dhaka");

    /** A clock the test sets. */
    static final class MovableClock extends Clock {
        private volatile Instant now = Instant.now();

        void set(Instant instant) {
            now = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.fixed(now, zone);
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        MovableClock movableClock() {
            return new MovableClock();
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    MovableClock clock;

    @Autowired
    MedicationReminders reminders;

    @Autowired
    CareEventListener listener;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID nazmun;
    UUID rafid;
    UUID rahima;
    LocalDate today;

    @BeforeEach
    void family() {
        jdbc.update("delete from outbox_event");
        jdbc.update("delete from medication");
        jdbc.update("delete from emergency_info");
        jdbc.update("delete from health_profile");
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        nazmun = family.addMember("Nazmun Nahar", "contributor", List.of(), new Availability(List.of(true, true, true, true, true, true, true), List.of()), true, false);
        rafid = family.addMember("Rafid Mannan", "contributor");
        rahima = family.addDependant("Rahima Khatun", "Grandmother");
        family.signInAs(afsara);
        today = LocalDate.now(DHAKA);
        clock.set(local(today, 7, 0));
    }

    private static Instant local(LocalDate day, int hour, int minute) {
        return ZonedDateTime.of(day, java.time.LocalTime.of(hour, minute), DHAKA).toInstant();
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

    private Map<String, Object> medicine(UUID person, UUID carer, boolean reminders) {
        Map<String, Object> input = new HashMap<>();
        input.put("personId", person.toString());
        input.put("name", "Amlodipine");
        input.put("dose", "1 tablet");
        input.put("instructions", "after breakfast");
        input.put("times", List.of("20:00", "08:00"));
        input.put("days", List.of(true, true, true, true, true, true, true));
        input.put("startDate", today.toString());
        input.put("carerId", carer == null ? null : carer.toString());
        input.put("reminders", reminders);
        return input;
    }

    private JsonNode doses() throws Exception {
        return call(get("/api/v1/medications/doses").param("from", local(today, 0, 0).toString()).param("to", local(today, 23, 59).toString()), null, 200);
    }

    @Test
    void aMedicineForGrandmaIsSharedWithHerCarerAndPeopleWithMedicalAccessOnly() throws Exception {
        call(post("/api/v1/medications"), medicine(rahima, null, true), 422);
        JsonNode created = call(post("/api/v1/medications"), medicine(rahima, nazmun, true), 201);
        assertThat(created.get("times")).extracting(JsonNode::asText).containsExactly("08:00", "20:00");

        DomainEvent event = OutboxEvents.last(jdbc, json, EventTypes.MEDICATION_UPDATED);
        assertThat(event.audit().action()).isEqualTo("Added a medicine schedule");
        assertThat(event.audit().subject()).isEqualTo("Rahima Khatun");
        assertThat(event.notification().recipientId()).isEqualTo(nazmun);

        family.signInAs(nazmun);
        assertThat(call(get("/api/v1/medications"), null, 200)).hasSize(1);
        family.signInAs(rafid);
        assertThat(call(get("/api/v1/medications"), null, 200)).isEmpty();
        call(post("/api/v1/medications/" + created.get("id").asText() + "/doses"), Map.of("scheduledAt", local(today, 8, 0).toString(), "status", "taken"), 404);
        call(post("/api/v1/medications"), medicine(rahima, rafid, true), 403);
    }

    @Test
    void dosesAreMarkedOnlyAtTheirTimeAndShowWhatHappened() throws Exception {
        String id = call(post("/api/v1/medications"), medicine(rahima, nazmun, true), 201).get("id").asText();
        clock.set(local(today, 8, 10));

        JsonNode list = doses();
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("status").asText()).isEqualTo("due");
        assertThat(list.get(1).get("status").asText()).isEqualTo("upcoming");

        family.signInAs(nazmun);
        call(post("/api/v1/medications/" + id + "/doses"), Map.of("scheduledAt", local(today, 8, 5).toString(), "status", "taken"), 422);
        call(post("/api/v1/medications/" + id + "/doses"), Map.of("scheduledAt", local(today, 20, 0).toString(), "status", "taken"), 422);
        JsonNode taken = call(post("/api/v1/medications/" + id + "/doses"), Map.of("scheduledAt", local(today, 8, 0).toString(), "status", "taken"), 200);
        assertThat(taken.get("recordedById").asText()).isEqualTo(nazmun.toString());
        assertThat(doses().get(0).get("status").asText()).isEqualTo("taken");

        clock.set(local(today, 21, 30));
        assertThat(doses().get(1).get("status").asText()).isEqualTo("missed");
    }

    @Test
    void remindersAndMissedAlertsGoOutOnceToThePersonAndTheCarer() throws Exception {
        call(post("/api/v1/medications"), medicine(rahima, nazmun, true), 201);
        jdbc.update("delete from outbox_event");

        clock.set(local(today, 8, 1));
        reminders.run();
        reminders.run();
        List<DomainEvent> due = OutboxEvents.ofType(jdbc, json, EventTypes.MEDICATION_DUE);
        assertThat(due).extracting(e -> e.notification().recipientId()).containsExactlyInAnyOrder(rahima, nazmun);
        assertThat(due.get(0).notification().message()).isEqualTo("Time for Amlodipine (1 tablet) — after breakfast.");

        clock.set(local(today, 9, 5));
        reminders.run();
        reminders.run();
        List<DomainEvent> missed = OutboxEvents.ofType(jdbc, json, EventTypes.MEDICATION_MISSED);
        assertThat(missed).hasSize(2);
        assertThat(missed.get(0).notification().message()).contains("8:00 AM dose of Amlodipine wasn’t marked as taken");
        assertThat(jdbc.queryForObject("select status from medication_dose", String.class)).isEqualTo("missed");

        // Marking it late (someone forgot) replaces "missed" with "taken".
        family.signInAs(nazmun);
        String id = call(get("/api/v1/medications"), null, 200).get(0).get("id").asText();
        call(post("/api/v1/medications/" + id + "/doses"), Map.of("scheduledAt", local(today, 8, 0).toString(), "status", "taken"), 200);
        assertThat(jdbc.queryForObject("select status from medication_dose", String.class)).isEqualTo("taken");
    }

    @Test
    void aMembersOwnMedicineStaysPrivateUntilTheyShareTheirHealthNotes() throws Exception {
        family.signInAs(rafid);
        call(post("/api/v1/medications"), medicine(rafid, null, true), 201);
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.MEDICATION_UPDATED).audit()).isNull();

        family.signInAs(afsara);
        assertThat(call(get("/api/v1/medications"), null, 200)).isEmpty();

        family.signInAs(rafid);
        call(put("/api/v1/health/profiles/" + rafid), Map.of("conditions", List.of(), "goals", List.of(), "avoid", List.of(), "preferences", List.of(), "notes", "", "shared", true), 200);
        family.signInAs(afsara);
        assertThat(call(get("/api/v1/medications"), null, 200)).hasSize(1);
        family.signInAs(nazmun);
        assertThat(call(get("/api/v1/medications"), null, 200)).hasSize(1);
    }

    @Test
    void theEmergencyCardFollowsHealthAccess() throws Exception {
        assertThat(call(get("/api/v1/health/emergency/" + rahima), null, 200).get("bloodGroup").asText()).isEmpty();
        call(put("/api/v1/health/emergency/" + rahima), Map.of("bloodGroup", "Z+", "allergies", "", "doctorName", "", "doctorPhone", "", "hospital", "", "notes", ""), 400);
        JsonNode saved = call(put("/api/v1/health/emergency/" + rahima),
                Map.of("bloodGroup", "B+", "allergies", "Penicillin", "doctorName", "Dr. Karim", "doctorPhone", "+880 1711-000000", "hospital", "Square Hospital", "notes", "Uses a walker"), 200);
        assertThat(saved.get("allergies").asText()).isEqualTo("Penicillin");
        assertThat(OutboxEvents.last(jdbc, json, EventTypes.EMERGENCY_INFO_UPDATED).audit().action()).isEqualTo("Updated the emergency card");

        family.signInAs(nazmun);
        assertThat(call(get("/api/v1/health/emergency/" + rahima), null, 200).get("bloodGroup").asText()).isEqualTo("B+");
        call(put("/api/v1/health/emergency/" + rahima), Map.of("bloodGroup", "O+"), 200);
        family.signInAs(rafid);
        call(get("/api/v1/health/emergency/" + rahima), null, 403);
        call(get("/api/v1/health/emergency/" + afsara), null, 403);
    }

    @Test
    void someoneLeavingTakesTheirMedicinesAndStopsBeingACarer() throws Exception {
        call(post("/api/v1/medications"), medicine(rahima, nazmun, false), 201);
        family.signInAs(nazmun);
        call(post("/api/v1/medications"), medicine(nazmun, null, false), 201);

        listener.handle(Events.of(EventTypes.MEMBER_REMOVED, family.familyId(), afsara).data("memberId", nazmun.toString()).build());

        family.signInAs(afsara);
        JsonNode left = call(get("/api/v1/medications"), null, 200);
        assertThat(left).hasSize(1);
        assertThat(left.get(0).has("carerId")).isFalse();
        call(delete("/api/v1/medications/" + left.get(0).get("id").asText()), null, 204);
        assertThat(call(get("/api/v1/medications"), null, 200)).isEmpty();
    }
}
