package com.hearth.audit.application;

import com.hearth.audit.dto.AuditEventView;
import com.hearth.audit.repository.AuditEventRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
        return list(null, null, 0, 500);
    }

    @Transactional(readOnly = true)
    public List<AuditEventView> list(String category, UUID actorId, int page, int size) {
        FamilyContext context = directory.context();
        int pageSize = (size <= 0) ? 50 : Math.min(size, 500);
        int pageNumber = Math.max(0, page);
        Pageable pageable = PageRequest.of(pageNumber, pageSize);
        return events.findFiltered(context.familyId(), category, actorId, pageable).stream()
                .map(e -> new AuditEventView(e.getId(), e.getActorId(), e.getCategory(), e.getAction(), e.getSubject(), e.getOccurredAt(), e.getBeforeValue(), e.getAfterValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AuditEventView> listPaged(String category, UUID actorId, Pageable pageable) {
        FamilyContext context = directory.context();
        return events.findFilteredPaged(context.familyId(), category, actorId, pageable)
                .map(e -> new AuditEventView(e.getId(), e.getActorId(), e.getCategory(), e.getAction(), e.getSubject(), e.getOccurredAt(), e.getBeforeValue(), e.getAfterValue()));
    }
}

