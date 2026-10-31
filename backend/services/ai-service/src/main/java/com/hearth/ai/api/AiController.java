package com.hearth.ai.api;

import com.hearth.ai.application.AiGuard;
import com.hearth.ai.application.DraftService;
import com.hearth.ai.application.PlanService;
import com.hearth.ai.application.QuickAddService;
import com.hearth.ai.dto.AiDtos.AiStatus;
import com.hearth.ai.dto.AiDtos.ConsentRequest;
import com.hearth.ai.dto.AiDtos.DraftRequest;
import com.hearth.ai.dto.AiDtos.DraftResult;
import com.hearth.ai.dto.AiDtos.PlanResult;
import com.hearth.ai.dto.AiDtos.QuickAddRequest;
import com.hearth.ai.dto.AiDtos.QuickAddResult;
import com.hearth.common.family.FamilyDirectory;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final FamilyDirectory directory;
    private final AiGuard guard;
    private final QuickAddService quickAdd;
    private final PlanService plan;
    private final DraftService drafts;

    public AiController(FamilyDirectory directory, AiGuard guard, QuickAddService quickAdd, PlanService plan, DraftService drafts) {
        this.directory = directory;
        this.guard = guard;
        this.quickAdd = quickAdd;
        this.plan = plan;
        this.drafts = drafts;
    }

    /** Whether AI help is available to the caller, and how much of today's allowance is left. */
    @GetMapping("/status")
    public AiStatus status() {
        return guard.status(directory.context());
    }

    /** Turn AI help on or off for the caller. */
    @PutMapping("/consent")
    public AiStatus consent(@Valid @RequestBody ConsentRequest request) {
        var context = directory.context();
        guard.setConsent(context, request.granted());
        return guard.status(context);
    }

    /** Task drafts from a sentence. Nothing is saved. */
    @PostMapping("/quick-add")
    public QuickAddResult quickAdd(@Valid @RequestBody QuickAddRequest request) {
        return quickAdd.draft(request.text());
    }

    /** Suggested changes to the next seven days, each already checked by the decision engine. Nothing is changed. */
    @PostMapping("/plan")
    public PlanResult plan() {
        return plan.plan();
    }

    /** A message draft for the person to edit and send. */
    @PostMapping("/drafts")
    public DraftResult draft(@Valid @RequestBody DraftRequest request) {
        return drafts.draft(request);
    }
}
