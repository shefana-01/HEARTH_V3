package com.hearth.audit.application;

import com.hearth.audit.dto.AuditEventView;
import com.hearth.audit.repository.AuditEventRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads the family's activity log, newest first. Only what the family may know is ever written to it. */
@Service
public class AuditService {

    private final FamilyDirectory directory;
    private final AuditEventRepository events;

    public AuditService(FamilyDirectory directory, AuditEventRepository events) {
        this.directory = directory;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<AuditEventView> list() {
        FamilyContext context = directory.context();
        return events.findTop500ByFamilyIdOrderByOccurredAtDesc(context.familyId()).stream()
                .map(e -> new AuditEventView(e.getId(), e.getActorId(), e.getCategory(), e.getAction(), e.getSubject(), e.getOccurredAt(), e.getBeforeValue(), e.getAfterValue()))
                .toList();
    }
}
