package com.hearth.care.graph;

/**
 * The Cypher statements behind the family map. Every node carries the family id, so one family's map can
 * never reach another's. Node labels and relationship types are fixed words chosen in code (Cypher cannot take
 * them as parameters); everything else is passed as parameters, never pasted into the text.
 */
final class GraphQueries {

    static final String INDEX = "CREATE INDEX care_node_family IF NOT EXISTS FOR (n:CareNode) ON (n.familyId)";

    static final String CLEAR_FAMILY = "MATCH (n:CareNode {familyId: $familyId}) DETACH DELETE n";

    /** %s is the node label for one kind (Family, Member, Dependant, Appointment, Task); see {@link CareGraphService#nodeLabel}. */
    static final String CREATE_NODES = """
            UNWIND $nodes AS node
            CREATE (n:CareNode:%s {familyId: $familyId, id: node.id, kind: node.kind, label: node.label, detail: node.detail,
                                   start: node.start, role: node.role, href: node.href, position: node.position})
            """;

    /** %s is one of the fixed relationship types in {@link CareGraphService#relationshipType}. */
    static final String CREATE_EDGES = """
            UNWIND $edges AS edge
            MATCH (a:CareNode {familyId: $familyId, id: edge.from})
            MATCH (b:CareNode {familyId: $familyId, id: edge.to})
            CREATE (a)-[:%s {label: edge.label, position: edge.position}]->(b)
            """;

    static final String READ_NODES = """
            MATCH (n:CareNode {familyId: $familyId})
            RETURN n.id AS id, n.kind AS kind, n.label AS label, n.detail AS detail, n.start AS start, n.role AS role, n.href AS href
            ORDER BY n.position
            """;

    static final String READ_EDGES = """
            MATCH (a:CareNode {familyId: $familyId})-[r]->(b:CareNode {familyId: $familyId})
            RETURN a.id AS source, b.id AS target, r.label AS label
            ORDER BY r.position
            """;

    private GraphQueries() {
    }
}
