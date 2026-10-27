package com.hearth.audit.api;

import com.hearth.audit.application.AuditService;
import com.hearth.audit.dto.AuditEventView;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-events")
public class AuditController {

    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    public List<AuditEventView> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "500") int size) {
        return audit.list(category, actorId, page, size);
    }
}

