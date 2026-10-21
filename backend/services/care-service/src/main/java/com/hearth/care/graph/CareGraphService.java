package com.hearth.care.graph;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.care.domain.Appointment;
import com.hearth.care.graph.GraphBuilder.AppointmentFacts;
import com.hearth.care.graph.GraphBuilder.FamilyFacts;
import com.hearth.care.graph.GraphBuilder.PersonFacts;
import com.hearth.care.graph.GraphBuilder.TaskFacts;
import com.hearth.care.graph.GraphModel.Edge;
import com.hearth.care.graph.GraphModel.Graph;
import com.hearth.care.graph.GraphModel.Node;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.http.ServiceClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The family map, kept in Neo4j.
 *
 * Each family's map is a small subgraph: (:Family), (:Member), (:Dependant), (:Appointment) and (:Task)
 * nodes joined by MEMBER_OF, LOOKED_AFTER, DOES, FOR, NEEDED_FOR and GOES_ALONG relationships. It is a
 * projection of data owned by other services, so it is rebuilt when Kafka events say something changed
 * ({@code graph_state.version}) or after {@code hearth.graph.max-age-seconds}, and otherwise read straight
 * from Neo4j. If Neo4j cannot be reached the map is computed directly, so the screen keeps working.
 */
@Service
public class CareGraphService {

    private static final Logger log = LoggerFactory.getLogger(CareGraphService.class);

    private static final Map<String, String> NODE_LABELS = Map.of(
            "family", "Family", "member", "Member", "dependant", "Dependant", "appointment", "Appointment", "task", "Task");

    private final FamilyDirectory directory;
    private final AppointmentRepository appointments;
    private final ServiceClient services;
    private final JdbcTemplate jdbc;
    private final Driver neo4j;
    private final String familyServiceUrl;
    private final String taskServiceUrl;
    private final Duration maxAge;
    private final AtomicBoolean indexReady = new AtomicBoolean();
    private final Map<UUID, Object> rebuildLocks = new ConcurrentHashMap<>();

    public CareGraphService(
            FamilyDirectory directory,
            AppointmentRepository appointments,
            ServiceClient services,
            JdbcTemplate jdbc,
            Driver neo4j,
            @Value("${hearth.services.family}") String familyServiceUrl,
            @Value("${hearth.services.task}") String taskServiceUrl,
            @Value("${hearth.graph.max-age-seconds:60}") long maxAgeSeconds) {
        this.directory = directory;
        this.appointments = appointments;
        this.services = services;
        this.jdbc = jdbc;
        this.neo4j = neo4j;
        this.familyServiceUrl = familyServiceUrl;
        this.taskServiceUrl = taskServiceUrl;
        this.maxAge = Duration.ofSeconds(maxAgeSeconds);
    }

    public Graph get() {
        FamilyContext context = directory.context();
        UUID familyId = context.familyId();
        GraphState state = state(familyId);
        try {
            if (state.isStale(Instant.now(), maxAge)) {
                // One rebuild per family at a time, so two people opening the map together do not interleave.
                synchronized (rebuildLocks.computeIfAbsent(familyId, id -> new Object())) {
                    if (state(familyId).isStale(Instant.now(), maxAge)) {
                        Graph fresh = compute(context);
                        write(familyId, fresh);
                        jdbc.update("update graph_state set built_version = ?, built_at = now() where family_id = ?", state.version(), familyId);
                    }
                }
            }
            return read(familyId);
        } catch (org.neo4j.driver.exceptions.Neo4jException ex) {
            log.warn("Neo4j is not reachable; computing the family map directly: {}", ex.getMessage());
            return compute(context);
        }
    }

    /** Something on the map changed (called by the event listener): the next look rebuilds it. */
    public void markChanged(UUID familyId) {
        jdbc.update("insert into graph_state (family_id, version) values (?, 1) on conflict (family_id) do update set version = graph_state.version + 1", familyId);
    }

    /* ───────── building ───────── */

    private Graph compute(FamilyContext context) {
        JsonNode family = services.get(familyServiceUrl + "/api/v1/family", JsonNode.class);
        if (family == null || family.isNull() || family.isMissingNode()) {
            return Graph.empty();
        }
        JsonNode members = services.get(familyServiceUrl + "/api/v1/members", JsonNode.class);
        JsonNode tasks = services.get(taskServiceUrl + "/api/v1/tasks", JsonNode.class);

        List<PersonFacts> memberFacts = new ArrayList<>();
        for (JsonNode m : members) {
            memberFacts.add(new PersonFacts(UUID.fromString(m.path("id").asText()), m.path("name").asText(), m.path("relation").asText(""), m.path("role").asText(), m.path("status").asText()));
        }
        List<PersonFacts> dependantFacts = new ArrayList<>();
        for (JsonNode d : family.path("dependants")) {
            dependantFacts.add(new PersonFacts(UUID.fromString(d.path("id").asText()), d.path("name").asText(), d.path("relation").asText(""), null, "active"));
        }
        List<TaskFacts> taskFacts = new ArrayList<>();
        for (JsonNode t : tasks) {
            taskFacts.add(new TaskFacts(UUID.fromString(t.path("id").asText()), t.path("title").asText(), Instant.parse(t.path("start").asText()), t.path("status").asText(),
                    t.path("visibility").asText(), uuid(t, "assigneeId"), uuid(t, "forId"), uuid(t, "appointmentId")));
        }
        List<AppointmentFacts> appointmentFacts = appointments.findByFamilyIdOrderByStartAtAsc(context.familyId()).stream()
                .filter(Appointment::isShared)
                .map(a -> new AppointmentFacts(a.getId(), a.getTitle(), a.getStartAt(), a.getVisibility(), a.getForId(), a.getEscortId()))
                .toList();
        return GraphBuilder.build(new FamilyFacts(family.path("name").asText(), family.path("location").asText("")), memberFacts, dependantFacts, taskFacts, appointmentFacts, Instant.now());
    }

    /* ───────── Neo4j ───────── */

    /** Replaces the family's subgraph in one transaction. */
    private void write(UUID familyId, Graph graph) {
        ensureIndex();
        Map<String, List<Map<String, Object>>> nodesByLabel = new LinkedHashMap<>();
        for (int i = 0; i < graph.nodes().size(); i++) {
            Node node = graph.nodes().get(i);
            Map<String, Object> props = new HashMap<>();
            props.put("id", node.id());
            props.put("kind", node.kind());
            props.put("label", node.label());
            props.put("detail", node.detail());
            props.put("start", node.start() == null ? null : node.start().toString());
            props.put("role", node.role());
            props.put("href", node.href());
            props.put("position", i);
            nodesByLabel.computeIfAbsent(nodeLabel(node.kind()), k -> new ArrayList<>()).add(props);
        }
        Map<String, List<Map<String, Object>>> edgesByType = new LinkedHashMap<>();
        for (int i = 0; i < graph.edges().size(); i++) {
            Edge edge = graph.edges().get(i);
            edgesByType.computeIfAbsent(relationshipType(edge.label()), k -> new ArrayList<>())
                    .add(Map.of("from", edge.from(), "to", edge.to(), "label", edge.label(), "position", i));
        }
        String family = familyId.toString();
        try (Session session = neo4j.session()) {
            session.executeWrite(tx -> {
                tx.run(GraphQueries.CLEAR_FAMILY, Values.parameters("familyId", family)).consume();
                nodesByLabel.forEach((label, nodes) -> tx.run(GraphQueries.CREATE_NODES.formatted(label), Values.parameters("familyId", family, "nodes", nodes)).consume());
                edgesByType.forEach((type, edges) -> tx.run(GraphQueries.CREATE_EDGES.formatted(type), Values.parameters("familyId", family, "edges", edges)).consume());
                return null;
            });
        }
    }

    private Graph read(UUID familyId) {
        String family = familyId.toString();
        try (Session session = neo4j.session()) {
            return session.executeRead(tx -> {
                List<Node> nodes = tx.run(GraphQueries.READ_NODES, Values.parameters("familyId", family)).list(CareGraphService::node);
                List<Edge> edges = tx.run(GraphQueries.READ_EDGES, Values.parameters("familyId", family)).list(r -> new Edge(r.get("source").asString(), r.get("target").asString(), r.get("label").asString()));
                return new Graph(nodes, edges);
            });
        }
    }

    private void ensureIndex() {
        if (indexReady.compareAndSet(false, true)) {
            try (Session session = neo4j.session()) {
                session.executeWrite(tx -> tx.run(GraphQueries.INDEX).consume());
            } catch (RuntimeException ex) {
                indexReady.set(false);
                throw ex;
            }
        }
    }

    private static Node node(Record r) {
        String start = r.get("start").isNull() ? null : r.get("start").asString();
        return new Node(r.get("id").asString(), r.get("kind").asString(), r.get("label").asString(), text(r, "detail"), start == null ? null : Instant.parse(start), text(r, "role"), text(r, "href"));
    }

    private static String text(Record r, String key) {
        return r.get(key).isNull() ? null : r.get(key).asString();
    }

    static String nodeLabel(String kind) {
        String label = NODE_LABELS.get(kind);
        if (label == null) {
            throw new IllegalArgumentException("Unknown node kind " + kind);
        }
        return label;
    }

    /** A readable relationship type for each kind of edge. The wording shown on the map stays on the relationship. */
    static String relationshipType(String label) {
        if (label.equals("member")) {
            return "MEMBER_OF";
        }
        if (label.equals("looked after")) {
            return "LOOKED_AFTER";
        }
        if (label.equals("does")) {
            return "DOES";
        }
        if (label.equals("needed for")) {
            return "NEEDED_FOR";
        }
        if (label.equals("goes along")) {
            return "GOES_ALONG";
        }
        if (label.startsWith("for ")) {
            return "FOR";
        }
        throw new IllegalArgumentException("Unknown edge " + label);
    }

    private static UUID uuid(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asText().isBlank() ? null : UUID.fromString(value.asText());
    }

    /* ───────── staleness ───────── */

    record GraphState(long version, long builtVersion, Instant builtAt) {

        boolean isStale(Instant now, Duration maxAge) {
            return builtVersion < version || builtAt == null || builtAt.plus(maxAge).isBefore(now);
        }
    }

    private GraphState state(UUID familyId) {
        jdbc.update("insert into graph_state (family_id) values (?) on conflict (family_id) do nothing", familyId);
        return jdbc.queryForObject("select version, built_version, built_at from graph_state where family_id = ?",
                (rs, row) -> new GraphState(rs.getLong("version"), rs.getLong("built_version"), rs.getTimestamp("built_at") == null ? null : rs.getTimestamp("built_at").toInstant()),
                familyId);
    }
}
