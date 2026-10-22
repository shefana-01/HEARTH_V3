package com.hearth.decision.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.text.Formats;
import com.hearth.decision.application.Planning.Snapshot;
import com.hearth.decision.domain.ReassignmentRequest;
import com.hearth.decision.dto.DecisionDtos.AttentionItem;
import com.hearth.decision.dto.DecisionDtos.PreviewRequest;
import com.hearth.decision.dto.DecisionDtos.TaskInsight;
import com.hearth.decision.engine.DecisionEngine;
import com.hearth.decision.engine.DecisionEngine.Scored;
import com.hearth.decision.engine.Model.CandidateScore;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.PriorityBreakdown;
import com.hearth.decision.engine.Model.RankedTask;
import com.hearth.decision.engine.Model.SimulationChange;
import com.hearth.decision.engine.Model.SimulationResult;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.repository.ReassignmentRequestRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The decision engine's answers for the signed-in person, and the changes it can make (keep a clash, apply a what-if). */
@Service
public class DecisionService {

    private final Planning planning;
    private final ReassignmentRequestRepository requests;
    private final ServiceClient services;
    private final EventPublisher events;
    private final String taskServiceUrl;

    public DecisionService(Planning planning, ReassignmentRequestRepository requests, ServiceClient services, EventPublisher events, @Value("${hearth.services.task}") String taskServiceUrl) {
        this.planning = planning;
        this.requests = requests;
        this.services = services;
        this.events = events;
        this.taskServiceUrl = taskServiceUrl;
    }

    /** Shared tasks that cannot go ahead as planned, most pressing first. Private tasks are their owner's to sort out (in "My day"). */
    @Transactional(readOnly = true)
    public List<AttentionItem> attention() {
        Snapshot s = planning.load();
        record Item(AttentionItem item, Scored scored) {
        }
        List<Item> items = new ArrayList<>();
        for (Conflict conflict : DecisionEngine.detectConflicts(s.data(), s.now())) {
            Task task = s.task(conflict.taskId()).orElse(null);
            if (task == null || task.isPrivate()) {
                continue;
            }
            PriorityBreakdown priority = DecisionEngine.priorityScore(task, s.data(), conflict, s.now());
            List<CandidateScore> candidates = DecisionEngine.scoreCandidates(task, s.data());
            AttentionItem item = new AttentionItem(conflict, task, priority, candidates.isEmpty() ? null : candidates.get(0), openRequestId(s, task.id()));
            items.add(new Item(item, new Scored(task, priority)));
        }
        items.sort((a, b) -> DecisionEngine.compareByPriority(a.scored(), b.scored()));
        return items.stream().map(Item::item).toList();
    }

    /** The caller's open tasks in the order to do them, with the reason for each place. */
    @Transactional(readOnly = true)
    public List<RankedTask> myDay() {
        Snapshot s = planning.load();
        return DecisionEngine.rankTasks(s.me(), s.data(), s.now());
    }

    @Transactional(readOnly = true)
    public TaskInsight insight(UUID taskId) {
        Snapshot s = planning.load();
        Task task = s.visibleTask(taskId.toString()).orElseThrow(() -> ApiException.notFound("That task"));
        Conflict conflict = conflictFor(s, task.id());
        return new TaskInsight(conflict, DecisionEngine.priorityScore(task, s.data(), conflict, s.now()), DecisionEngine.scoreCandidates(task, s.data()), openRequestId(s, task.id()));
    }

    /** Scores everyone for a task still being drafted, so the form can warn about clashes before it is saved. */
    @Transactional(readOnly = true)
    public List<CandidateScore> preview(PreviewRequest draft) {
        if (draft.durationMin() < 5 || draft.durationMin() > 1440) {
            throw ApiException.unprocessable("A task takes between 5 minutes and 24 hours.");
        }
        Snapshot s = planning.load();
        Task temp = new Task(draft.taskId() == null ? "__draft__" : draft.taskId(), "Draft", "", draft.category(), "routine", "scheduled", draft.start(), draft.durationMin(),
                null, null, "family", "", Instant.now(), null, null, null, false, null);
        return DecisionEngine.scoreCandidates(temp, s.data());
    }

    /** Keep the current plan even though a clash was found. */
    @Transactional
    public void acknowledge(UUID taskId) {
        Snapshot s = planning.load();
        Task task = s.visibleTask(taskId.toString()).orElseThrow(() -> ApiException.notFound("That task"));
        Conflict conflict = conflictFor(s, task.id());
        if (conflict == null) {
            return;
        }
        services.post(taskServiceUrl + "/api/v1/internal/tasks/" + taskId + "/acknowledge", Map.of("kind", conflict.kind()), Void.class);
        Events event = Events.of(EventTypes.TASK_CONFLICT_KEPT, s.context()).data("taskId", taskId).data("kind", conflict.kind());
        if (!task.isPrivate()) {
            event.audit("tasks", "Kept a task despite a clash", task.title(), null, conflict.reason());
        }
        events.publish(Topics.DECISION, event.build());
    }

    /** What-if: evaluate a change without saving it. */
    @Transactional(readOnly = true)
    public SimulationResult simulate(SimulationChange change) {
        Snapshot s = planning.load();
        s.visibleTask(change.taskId()).orElseThrow(() -> ApiException.notFound("That task"));
        return DecisionEngine.simulate(change, s.data(), s.now());
    }

    /** Apply a simulated change to the real plan. An open handover request for the task is settled by it. */
    @Transactional
    public JsonNode apply(SimulationChange change) {
        Snapshot s = planning.load();
        Task task = s.visibleTask(change.taskId()).orElseThrow(() -> ApiException.notFound("That task"));
        if (task.isPrivate() && change.changeAssignee() && !Objects.equals(change.assigneeId(), task.assigneeId())) {
            throw ApiException.unprocessable("A private task can’t be given to someone else.");
        }
        s.context().requireContributor();
        String before = s.memberName(task.assigneeId()) + " · " + Formats.dayTime(task.start(), s.context().zone());

        Map<String, Object> plan = new HashMap<>();
        plan.put("changeAssignee", change.changeAssignee());
        plan.put("assigneeId", change.assigneeId());
        plan.put("start", change.start());
        JsonNode updated = services.put(taskServiceUrl + "/api/v1/internal/tasks/" + change.taskId() + "/plan", plan, JsonNode.class);

        if (change.changeAssignee() && change.assigneeId() != null) {
            requests.findByFamilyIdAndTaskIdAndStatus(s.context().familyId(), UUID.fromString(task.id()), ReassignmentRequest.OPEN).ifPresent(open -> {
                open.approve(UUID.fromString(change.assigneeId()));
                requests.save(open);
            });
        }
        String newAssignee = change.changeAssignee() ? change.assigneeId() : task.assigneeId();
        Instant newStart = change.start() != null ? change.start() : task.start();
        Events event = Events.of(EventTypes.PLAN_CHANGED, s.context()).data("taskId", task.id()).data("assigneeId", newAssignee);
        if (!task.isPrivate()) {
            event.audit("schedule", "Applied a what-if change", task.title(), before, s.memberName(newAssignee) + " · " + Formats.dayTime(newStart, s.context().zone()))
                    .notify("task", "The plan for “" + task.title() + "” was changed from the what-if planner.", "/tasks/" + task.id());
        }
        events.publish(Topics.DECISION, event.build());
        return updated;
    }

    private Conflict conflictFor(Snapshot s, String taskId) {
        return DecisionEngine.detectConflicts(s.data(), s.now()).stream().filter(c -> c.taskId().equals(taskId)).findFirst().orElse(null);
    }

    private String openRequestId(Snapshot s, String taskId) {
        return requests.findByFamilyIdAndTaskIdAndStatus(s.context().familyId(), UUID.fromString(taskId), ReassignmentRequest.OPEN).map(r -> r.getId().toString()).orElse(null);
    }
}
