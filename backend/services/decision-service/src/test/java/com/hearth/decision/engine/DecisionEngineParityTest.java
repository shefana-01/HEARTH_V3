package com.hearth.decision.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hearth.decision.engine.Model.Appointment;
import com.hearth.decision.engine.Model.BusyBlock;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.EngineData;
import com.hearth.decision.engine.Model.Member;
import com.hearth.decision.engine.Model.PersonalEvent;
import com.hearth.decision.engine.Model.SimulationChange;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.engine.Model.Unavailability;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * The Java engine must give exactly what the TypeScript reference engine gives, for 100 random families
 * (inputs and expected results come from {@code tools/engine-fixtures.mjs}). Compared: expanded busy time,
 * conflicts, candidate scores with their reasons, priority scores with their explanations, each member's
 * ranked day with tie-break wording, a what-if simulation and day loads.
 */
class DecisionEngineParityTest {

    private static final ObjectMapper JSON = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private static JsonNode fixtures;
    private static ZoneId zone;

    @BeforeAll
    static void load() throws Exception {
        try (InputStream in = new GZIPInputStream(DecisionEngineParityTest.class.getResourceAsStream("/engine-fixtures.json.gz"))) {
            fixtures = JSON.readTree(in);
        }
        zone = ZoneId.of(fixtures.get("timezone").asText());
        assertThat(fixtures.get("cases").size()).isGreaterThanOrEqualTo(100);
    }

    @Test
    void javaEngineMatchesTheReferenceEngine() throws Exception {
        int compared = 0;
        for (int n = 0; n < fixtures.get("cases").size(); n++) {
            JsonNode input = fixtures.get("cases").get(n).get("input");
            JsonNode expected = fixtures.get("cases").get(n).get("expected");
            Instant now = Instant.parse(input.get("now").asText());

            List<PersonalEvent> events = list(input.get("events"), PersonalEvent.class);
            List<BusyBlock> busy = Recurrence.expand(events, now.minus(Recurrence.LOOKBACK), now.plus(Recurrence.HORIZON), zone);
            same("case " + n + " busy", expected.get("busy"), busy);

            Set<String> owners = new LinkedHashSet<>();
            events.forEach(e -> owners.add(e.memberId()));
            List<Task> tasks = list(input.get("tasks"), Task.class);
            List<Member> members = list(input.get("members"), Member.class);
            EngineData data = new EngineData(tasks, list(input.get("appointments"), Appointment.class), members, list(input.get("unavailability"), Unavailability.class), busy, owners, input.get("viewerId").asText(), zone);

            List<Conflict> conflicts = DecisionEngine.detectConflicts(data, now);
            same("case " + n + " conflicts", expected.get("conflicts"), conflicts);

            for (Task task : tasks) {
                same("case " + n + " candidates for " + task.id(), expected.get("candidates").get(task.id()), DecisionEngine.scoreCandidates(task, data));
                Conflict conflict = conflicts.stream().filter(c -> c.taskId().equals(task.id())).findFirst().orElse(null);
                same("case " + n + " priority of " + task.id(), expected.get("priority").get(task.id()), DecisionEngine.priorityScore(task, data, conflict, now));
                compared += 2;
            }
            for (Member member : members) {
                same("case " + n + " ranked day of " + member.id(), expected.get("ranked").get(member.id()), DecisionEngine.rankTasks(member.id(), data, now));
                assertThat(DecisionEngine.dayLoadMinutes(member.id(), now, data)).as("case %d day load of %s", n, member.id()).isEqualTo(expected.get("dayLoad").get(member.id()).asDouble());
                compared += 2;
            }

            JsonNode change = expected.get("simulation").get("change");
            SimulationChange simulation = new SimulationChange(
                    change.get("taskId").asText(),
                    change.has("assigneeId"),
                    change.has("assigneeId") && !change.get("assigneeId").isNull() ? change.get("assigneeId").asText() : null,
                    change.has("start") ? Instant.parse(change.get("start").asText()) : null);
            same("case " + n + " simulation", expected.get("simulation").get("result"), DecisionEngine.simulate(simulation, data, now));
            compared += 4;
        }
        assertThat(compared).isGreaterThan(2000);
    }

    private static <T> List<T> list(JsonNode node, Class<T> type) throws Exception {
        List<T> items = new ArrayList<>();
        for (JsonNode item : node) {
            items.add(JSON.treeToValue(item, type));
        }
        return items;
    }

    /** Deep comparison: same keys, same text, numbers equal, and timestamps equal as instants (".000Z" or not). */
    private static void same(String what, JsonNode expected, Object actualValue) {
        JsonNode actual = JSON.valueToTree(actualValue);
        String difference = difference("", expected, actual);
        if (difference != null) {
            fail(what + " differs at " + difference + "\nexpected: " + expected + "\nactual:   " + actual);
        }
    }

    private static String difference(String path, JsonNode expected, JsonNode actual) {
        if (expected == null || expected.isNull() || expected.isMissingNode()) {
            return actual == null || actual.isNull() || actual.isMissingNode() ? null : path + " (expected nothing, got " + actual + ")";
        }
        if (actual == null || actual.isNull()) {
            return path + " (missing, expected " + expected + ")";
        }
        if (expected.isNumber()) {
            return actual.isNumber() && Math.abs(expected.asDouble() - actual.asDouble()) < 1e-9 ? null : path + " (" + expected + " vs " + actual + ")";
        }
        if (expected.isTextual()) {
            if (expected.asText().equals(actual.asText())) {
                return null;
            }
            return sameInstant(expected.asText(), actual.asText()) ? null : path + " (\"" + expected.asText() + "\" vs \"" + actual.asText() + "\")";
        }
        if (expected.isBoolean()) {
            return expected.asBoolean() == actual.asBoolean() && actual.isBoolean() ? null : path + " (" + expected + " vs " + actual + ")";
        }
        if (expected.isArray()) {
            if (!actual.isArray() || actual.size() != expected.size()) {
                return path + " (array of " + expected.size() + " vs " + actual + ")";
            }
            for (int i = 0; i < expected.size(); i++) {
                String d = difference(path + "[" + i + "]", expected.get(i), actual.get(i));
                if (d != null) {
                    return d;
                }
            }
            return null;
        }
        Set<String> keys = new TreeSet<>();
        expected.fieldNames().forEachRemaining(keys::add);
        Set<String> actualKeys = new TreeSet<>();
        actual.fieldNames().forEachRemaining(actualKeys::add);
        // Keys the browser leaves out when undefined may be absent on either side as long as the value is null.
        Set<String> all = new TreeSet<>(keys);
        all.addAll(actualKeys);
        for (String key : all) {
            String d = difference(path + "." + key, expected.get(key), actual.get(key));
            if (d != null) {
                return d;
            }
        }
        return null;
    }

    private static boolean sameInstant(String a, String b) {
        try {
            return Instant.parse(a).equals(Instant.parse(b));
        } catch (DateTimeParseException ex) {
            return false;
        }
    }
}
