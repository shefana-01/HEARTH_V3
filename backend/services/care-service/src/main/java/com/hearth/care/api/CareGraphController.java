package com.hearth.care.api;

import com.hearth.care.graph.CareGraphService;
import com.hearth.care.graph.GraphModel.Graph;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The family map: who is doing what for whom (from Neo4j). Wording and layout are added by the browser. */
@RestController
@RequestMapping("/api/v1/caregraph")
public class CareGraphController {

    private final CareGraphService graph;

    public CareGraphController(CareGraphService graph) {
        this.graph = graph;
    }

    @GetMapping
    public Graph get() {
        return graph.get();
    }
}
