package com.hearth.decision.api;

import com.hearth.decision.application.HandoverService;
import com.hearth.decision.dto.DecisionDtos.ApproveRequest;
import com.hearth.decision.dto.DecisionDtos.NewRequest;
import com.hearth.decision.dto.DecisionDtos.RequestDetail;
import com.hearth.decision.dto.DecisionDtos.RequestListItem;
import com.hearth.decision.dto.DecisionDtos.RequestView;
import jakarta.validation.Valid;
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

/** Handover requests ("Who can take it?"). */
@RestController
@RequestMapping("/api/v1/reassignment-requests")
public class HandoverController {

    private final HandoverService handovers;

    public HandoverController(HandoverService handovers) {
        this.handovers = handovers;
    }

    @GetMapping
    public List<RequestListItem> list() {
        return handovers.list();
    }

    /** Idempotent: asking again for the same task returns the request already open. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RequestView request(@Valid @RequestBody NewRequest request) {
        return handovers.request(request);
    }

    @GetMapping("/{id}")
    public RequestDetail get(@PathVariable UUID id) {
        return handovers.get(id);
    }

    @PostMapping("/{id}/approve")
    public RequestView approve(@PathVariable UUID id, @Valid @RequestBody ApproveRequest request) {
        return handovers.approve(id, request.memberId());
    }

    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable UUID id) {
        handovers.cancel(id);
    }
}
