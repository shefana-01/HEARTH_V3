package com.hearth.decision.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.text.Formats;
import com.hearth.decision.application.Planning.Snapshot;
import com.hearth.decision.domain.ReassignmentRequest;
import com.hearth.decision.dto.DecisionDtos.NewRequest;
import com.hearth.decision.dto.DecisionDtos.RequestDetail;
import com.hearth.decision.dto.DecisionDtos.RequestListItem;
import com.hearth.decision.dto.DecisionDtos.RequestView;
import com.hearth.decision.engine.DecisionEngine;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.repository.ReassignmentRequestRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handover requests: asking for someone else to take a shared task, choosing who, and settling it. Who may
 * settle one: the organiser, the person giving the task up (or whoever asked), and anyone volunteering
 * themselves.
 */
@Service
public class HandoverService {

    private final Planning planning;
    private final ReassignmentRequestRepository requests;
    private final ServiceClient services;
    private final EventPublisher events;
    private final String taskServiceUrl;

    public HandoverService(Planning planning, ReassignmentRequestRepository requests, ServiceClient services, EventPublisher events, @Value("${hearth.services.task}") String taskServiceUrl) {
        this.planning = planning;
        this.requests = requests;
        this.services = services;
        this.events = events;
        this.taskServiceUrl = taskServiceUrl;
    }

    /** Asks for someone else to take a shared task. Asking again returns the request already open. */
    @Transactional
    public RequestView request(NewRequest input) {
        Snapshot s = planning.load();
        s.context().requireContributor();
        Task task = s.visibleTask(input.taskId().toString()).orElseThrow(() -> ApiException.notFound("That task"));
        if (task.isPrivate()) {
            throw ApiException.unprocessable("A private task can’t be handed over. Share it with the family first.");
        }
        Optional<ReassignmentRequest> open = requests.findByFamilyIdAndTaskIdAndStatus(s.context().familyId(), input.taskId(), ReassignmentRequest.OPEN);
        if (open.isPresent()) {
            return view(open.get());
        }
        ReassignmentRequest request = new ReassignmentRequest(s.context().familyId(), input.taskId(), Planning.uuid(task.assigneeId()), input.reason().trim(), Formats.trim(input.note()), s.context().memberId());
        requests.save(request);
        events.publish(Topics.DECISION, Events.of(EventTypes.HANDOVER_REQUESTED, s.context())
                .audit("tasks", "Asked for someone to take over", task.title(), null, request.getReason())
                .notify("reassignment", "“" + task.title() + "” needs someone else. Can you take it?", "/priority/requests/" + request.getId())
                .data("requestId", request.getId())
                .data("taskId", task.id())
                .build());
        return view(request);
    }

    /** Every request of the family, newest first, with the title and time of its task. */
    @Transactional(readOnly = true)
    public List<RequestListItem> list() {
        Snapshot s = planning.load();
        return requests.findByFamilyIdOrderByCreatedAtDesc(s.context().familyId()).stream().map(r -> {
            Optional<Task> task = s.visibleTask(r.getTaskId().toString());
            String title = task.map(Task::title).filter(t -> !t.isBlank()).orElse("Removed task");
            return new RequestListItem(view(r), title, task.map(Task::start).orElse(r.getCreatedAt()));
        }).toList();
    }

    /** One request, with everyone scored as if the person giving it up still had it (so they are not a candidate). */
    @Transactional(readOnly = true)
    public RequestDetail get(UUID id) {
        Snapshot s = planning.load();
        ReassignmentRequest request = requests.findByIdAndFamilyId(id, s.context().familyId()).orElseThrow(() -> ApiException.notFound("That handover request"));
        Task task = s.visibleTask(request.getTaskId().toString()).orElseThrow(() -> ApiException.notFound("That handover request"));
        Task asRequested = task.withPlan(request.getFromMemberId() == null ? null : request.getFromMemberId().toString(), task.start());
        Conflict conflict = DecisionEngine.detectConflicts(s.data(), s.now()).stream().filter(c -> c.taskId().equals(task.id())).findFirst().orElse(null);
        return new RequestDetail(view(request), task, DecisionEngine.scoreCandidates(asRequested, s.data()), conflict);
    }

    /** Hands the task to {@code memberId}. Whoever goes along to a linked visit follows (care-service, on the event). */
    @Transactional
    public RequestView approve(UUID id, UUID memberId) {
        Snapshot s = planning.load();
        FamilyContext context = s.context();
        ReassignmentRequest request = requests.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That handover request"));
        Task task = s.visibleTask(request.getTaskId().toString()).orElseThrow(() -> ApiException.notFound("That handover request"));
        if (!request.isOpen()) {
            throw ApiException.conflict("This request has already been settled.");
        }
        if (s.member(memberId.toString()).isEmpty()) {
            throw ApiException.notFound("That family member");
        }
        if (!canApprove(request, memberId, context)) {
            throw ApiException.forbidden("Only the organiser, the person handing the task over, or the person taking it can confirm this.");
        }

        services.put(taskServiceUrl + "/api/v1/internal/tasks/" + task.id() + "/plan", Map.of("changeAssignee", true, "assigneeId", memberId.toString()), Void.class);
        request.approve(memberId);
        requests.save(request);

        String from = request.getFromMemberId() == null ? null : request.getFromMemberId().toString();
        String line = from != null
                ? s.firstName(memberId.toString()) + " took over “" + task.title() + "” from " + s.firstName(from) + "."
                : s.firstName(memberId.toString()) + " picked up “" + task.title() + "”.";
        events.publish(Topics.DECISION, Events.of(EventTypes.HANDOVER_APPROVED, context)
                .audit("tasks", "Handed over a task", task.title(), s.memberName(from), s.memberName(memberId.toString()))
                .notify("reassignment", line, "/tasks/" + task.id())
                .systemMessage(line)
                .data("requestId", request.getId())
                .data("taskId", task.id())
                .data("memberId", memberId)
                .data("appointmentId", task.appointmentId())
                .build());
        return view(request);
    }

    @Transactional
    public void cancel(UUID id) {
        Snapshot s = planning.load();
        s.context().requireContributor();
        ReassignmentRequest request = requests.findByIdAndFamilyId(id, s.context().familyId()).orElseThrow(() -> ApiException.notFound("That handover request"));
        if (!request.isOpen()) {
            return;
        }
        request.cancel();
        requests.save(request);
        events.publish(Topics.DECISION, Events.of(EventTypes.HANDOVER_CANCELLED, s.context()).data("requestId", request.getId()).data("taskId", request.getTaskId()).build());
    }

    /* ───────── from other services' events (no caller) ───────── */

    /** Someone reported time away: every shared task of theirs in that time gets an open request. */
    @Transactional
    public void openForTimeAway(UUID familyId, UUID memberId, List<UUID> taskIds, String reason, String note) {
        for (UUID taskId : taskIds) {
            if (requests.findByFamilyIdAndTaskIdAndStatus(familyId, taskId, ReassignmentRequest.OPEN).isPresent()) {
                continue;
            }
            try {
                requests.saveAndFlush(new ReassignmentRequest(familyId, taskId, memberId, Formats.clip(reason == null || reason.isBlank() ? "Unavailable." : reason, 200), Formats.clip(note == null ? "" : note, 500), memberId));
            } catch (DataIntegrityViolationException ex) {
                // Opened at the same moment by someone else; the one request is enough.
            }
        }
    }

    /** The task was cancelled or made private: nobody should be left holding a request for it. */
    @Transactional
    public void closeFor(UUID familyId, UUID taskId) {
        requests.findByFamilyIdAndTaskIdAndStatus(familyId, taskId, ReassignmentRequest.OPEN).ifPresent(open -> {
            open.cancel();
            requests.save(open);
        });
    }

    static boolean canApprove(ReassignmentRequest request, UUID toMemberId, FamilyContext viewer) {
        UUID me = viewer.memberId();
        return viewer.isLead() || Objects.equals(me, request.getFromMemberId()) || Objects.equals(me, request.getCreatedById()) || Objects.equals(me, toMemberId);
    }

    static RequestView view(ReassignmentRequest r) {
        return new RequestView(r.getId(), r.getTaskId(), r.getFromMemberId(), r.getReason(), r.getNote(), r.getCreatedAt(), r.getCreatedById(), r.getStatus(), r.getApprovedMemberId(), r.getResolvedAt());
    }
}
