package com.hearth.care.graph;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.time.Instant;
import java.util.List;

/** The family map as care-service returns it: the facts, without wording or layout (the browser adds those). */
public final class GraphModel {

    private GraphModel() {
    }

    /**
     * @param id     "family", "member:&lt;id&gt;", "dependant:&lt;id&gt;", "appt:&lt;id&gt;" or "task:&lt;id&gt;"
     * @param detail relationship (members, dependants) or location (family)
     * @param start  when it happens (appointments, tasks)
     */
    public record Node(
            String id,
            String kind,
            String label,
            @JsonInclude(Include.NON_NULL) String detail,
            @JsonInclude(Include.NON_NULL) Instant start,
            @JsonInclude(Include.NON_NULL) String role,
            @JsonInclude(Include.NON_NULL) String href) {
    }

    public record Edge(String from, String to, String label) {
    }

    public record Graph(List<Node> nodes, List<Edge> edges) {

        public static Graph empty() {
            return new Graph(List.of(), List.of());
        }
    }
}
