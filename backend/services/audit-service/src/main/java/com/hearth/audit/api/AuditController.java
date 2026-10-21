package com.hearth.audit.api;

import com.hearth.audit.application.AuditService;
import com.hearth.audit.dto.AuditEventView;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-events")
public class AuditController {

    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    public List<AuditEventView> list() {
        return audit.list();
    }
}
