package com.hearth.care.graph;

import com.hearth.care.graph.GraphModel.Edge;
import com.hearth.care.graph.GraphModel.Graph;
import com.hearth.care.graph.GraphModel.Node;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Who is doing what for whom, as nodes and edges. Pure: the same records always give the same graph
 * (a port of {@code buildGraph} in the frontend's careGraphService.ts). Private tasks and appointments
 * are never part of the map.
 */
public final class GraphBuilder {

    static final int MAX_TASKS = 6;
    static final int MAX_APPOINTMENTS = 3;

    public record FamilyFacts(String name, String location) {
    }

    public record PersonFacts(UUID id, String name, String relation, String role, String status) {
    }

    public record TaskFacts(UUID id, String title, Instant start, String status, String visibility, UUID assigneeId, UUID forId, UUID appointmentId) {
    }

    public record AppointmentFacts(UUID id, String title, Instant start, String visibility, UUID forId, UUID escortId) {
    }

    private GraphBuilder() {
    }

    public static Graph build(FamilyFacts family, List<PersonFacts> members, List<PersonFacts> dependants, List<TaskFacts> allTasks, List<AppointmentFacts> allAppointments, Instant now) {
        if (family == null) {
            return Graph.empty();
        }
        Map<UUID, PersonFacts> memberById = members.stream().collect(Collectors.toMap(PersonFacts::id, Function.identity(), (a, b) -> a));
        Map<UUID, PersonFacts> dependantById = dependants.stream().collect(Collectors.toMap(PersonFacts::id, Function.identity(), (a, b) -> a));
        Function<UUID, String> personNode = id -> id == null ? null : memberById.containsKey(id) ? "member:" + id : dependantById.containsKey(id) ? "dependant:" + id : null;
        Function<UUID, String> firstName = id -> {
            PersonFacts p = memberById.containsKey(id) ? memberById.get(id) : dependantById.get(id);
            return p == null || p.name() == null ? "" : p.name().trim().split("\\s+")[0];
        };
        Instant recent = now.minus(Duration.ofHours(1));

        List<TaskFacts> tasks = allTasks.stream()
                .filter(t -> "family".equals(t.visibility()) && "scheduled".equals(t.status()) && t.start().isAfter(recent))
                .sorted(Comparator.comparing(TaskFacts::start).thenComparing(t -> t.id().toString()))
                .limit(MAX_TASKS)
                .toList();
        List<AppointmentFacts> appointments = allAppointments.stream()
                .filter(a -> "family".equals(a.visibility()) && a.start().isAfter(recent))
                .sorted(Comparator.comparing(AppointmentFacts::start).thenComparing(a -> a.id().toString()))
                .limit(MAX_APPOINTMENTS)
                .toList();

        List<Edge> edges = new ArrayList<>();
        for (TaskFacts t : tasks) {
            link(edges, personNode.apply(t.assigneeId()), "task:" + t.id(), "does");
            if (t.forId() != null && !t.forId().equals(t.assigneeId())) {
                link(edges, "task:" + t.id(), personNode.apply(t.forId()), "for " + firstName.apply(t.forId()));
            }
            if (t.appointmentId() != null && appointments.stream().anyMatch(a -> a.id().equals(t.appointmentId()))) {
                link(edges, "task:" + t.id(), "appt:" + t.appointmentId(), "needed for");
            }
        }
        for (AppointmentFacts a : appointments) {
            link(edges, "appt:" + a.id(), personNode.apply(a.forId()), "for " + firstName.apply(a.forId()));
            if (a.escortId() != null && !a.escortId().equals(a.forId())) {
                link(edges, personNode.apply(a.escortId()), "appt:" + a.id(), "goes along");
            }
        }

        // Everyone active is on the map, so the family sees who is free as well as who is busy.
        List<Node> people = new ArrayList<>();
        members.stream().filter(m -> "active".equals(m.status())).forEach(m -> people.add(new Node("member:" + m.id(), "member", m.name(), m.relation(), null, m.role(), "/family/" + m.id())));
        dependants.forEach(d -> people.add(new Node("dependant:" + d.id(), "dependant", d.name(), d.relation(), null, null, "/health/" + d.id())));
        for (Node p : people) {
            edges.add(new Edge("family", p.id(), "member".equals(p.kind()) ? "member" : "looked after"));
        }

        List<Node> nodes = new ArrayList<>();
        nodes.add(new Node("family", "family", family.name(), family.location(), null, null, null));
        nodes.addAll(people);
        appointments.forEach(a -> nodes.add(new Node("appt:" + a.id(), "appointment", a.title(), null, a.start(), null, "/appointments/" + a.id())));
        tasks.forEach(t -> nodes.add(new Node("task:" + t.id(), "task", t.title(), null, t.start(), null, "/tasks/" + t.id())));
        return new Graph(nodes, edges);
    }

    private static void link(List<Edge> edges, String from, String to, String label) {
        if (from != null && to != null) {
            edges.add(new Edge(from, to, label));
        }
    }
}
