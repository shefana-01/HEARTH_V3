package com.hearth.decision.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.decision.application.DecisionService;
import com.hearth.decision.dto.DecisionDtos.AttentionItem;
import com.hearth.decision.dto.DecisionDtos.PreviewRequest;
import com.hearth.decision.dto.DecisionDtos.TaskInsight;
import com.hearth.decision.engine.Model.CandidateScore;
import com.hearth.decision.engine.Model.RankedTask;
import com.hearth.decision.engine.Model.SimulationChange;
import com.hearth.decision.engine.Model.SimulationResult;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/decisions")
public class DecisionController {

    private final DecisionService decisions;

    public DecisionController(DecisionService decisions) {
        this.decisions = decisions;
    }

    /** Shared tasks that cannot go ahead as planned, most pressing first. */
    @GetMapping("/attention")
    public List<AttentionItem> attention() {
        return decisions.attention();
    }

    /** The signed-in person's open tasks in the order to do them. */
    @GetMapping("/my-day")
    public List<RankedTask> myDay() {
        return decisions.myDay();
    }

    @GetMapping("/tasks/{taskId}/insight")
    public TaskInsight insight(@PathVariable UUID taskId) {
        return decisions.insight(taskId);
    }

    @PostMapping("/tasks/{taskId}/acknowledge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acknowledge(@PathVariable UUID taskId) {
        decisions.acknowledge(taskId);
    }

    @PostMapping("/candidates/preview")
    public List<CandidateScore> preview(@Valid @RequestBody PreviewRequest draft) {
        return decisions.preview(draft);
    }

    /** What-if: {"taskId", "assigneeId"?, "start"?}. Sending "assigneeId": null means "give it to nobody". */
    @PostMapping("/simulations")
    public SimulationResult simulate(@RequestBody JsonNode body) {
        return decisions.simulate(change(body));
    }

    @PostMapping("/simulations/apply")
    public JsonNode apply(@RequestBody JsonNode body) {
        return decisions.apply(change(body));
    }

    private static SimulationChange change(JsonNode body) {
        if (body == null || !body.hasNonNull("taskId")) {
            throw ApiException.badRequest("Choose the task to change.");
        }
        try {
            UUID.fromString(body.get("taskId").asText());
            boolean changeAssignee = body.has("assigneeId");
            String assignee = changeAssignee && !body.get("assigneeId").isNull() ? UUID.fromString(body.get("assigneeId").asText()).toString() : null;
            Instant start = body.hasNonNull("start") ? Instant.parse(body.get("start").asText()) : null;
            if (!changeAssignee && start == null) {
                throw ApiException.badRequest("Change who does it, when, or both.");
            }
            return new SimulationChange(body.get("taskId").asText(), changeAssignee, assignee, start);
        } catch (IllegalArgumentException | DateTimeParseException ex) {
            throw ApiException.badRequest("The request could not be read. Check the values and try again.");
        }
    }
}
