package com.hearth.audit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.audit.dto.AuditEventView;
import com.hearth.audit.entity.AuditEvent;
import com.hearth.audit.repository.AuditEventRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class AuditServiceTest {

    private FamilyDirectory directory;
    private AuditEventRepository repository;
    private AuditService service;

    private final UUID accountId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        repository = mock(AuditEventRepository.class);
        service = new AuditService(directory, repository);

        when(directory.context()).thenReturn(new FamilyContext(accountId, memberId, "Suprio", familyId, "lead", true, true, true, "UTC"));
    }

    private AuditEvent sampleEvent(String category, UUID actorId, String action, String subject) {
        AuditEvent event = new AuditEvent();
        event.setId(UUID.randomUUID());
        event.setFamilyId(familyId);
        event.setActorId(actorId);
        event.setCategory(category);
        event.setAction(action);
        event.setSubject(subject);
        event.setBeforeValue("Old");
        event.setAfterValue("New");
        event.setOccurredAt(Instant.now());
        event.setEventType("task.updated");
        event.setEventId(UUID.randomUUID());
        return event;
    }

    @Test
    @DisplayName("list() defaults to 500 items and returns mapped views")
    void listDefaultsTo500() {
        AuditEvent event = sampleEvent("tasks", memberId, "Completed", "Task 1");
        when(repository.findFiltered(eq(familyId), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(List.of(event));

        List<AuditEventView> result = service.list();

        assertThat(result).hasSize(1);
        AuditEventView view = result.get(0);
        assertThat(view.id()).isEqualTo(event.getId());
        assertThat(view.category()).isEqualTo("tasks");
        assertThat(view.action()).isEqualTo("Completed");
        assertThat(view.subject()).isEqualTo("Task 1");
        assertThat(view.actorId()).isEqualTo(memberId);
    }

    @Test
    @DisplayName("list with filters passes category, actorId, and pageable correctly")
    void listWithFilters() {
        AuditEvent event = sampleEvent("care", memberId, "Updated", "Profile");
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);

        when(repository.findFiltered(eq(familyId), eq("care"), eq(memberId), pageableCaptor.capture()))
                .thenReturn(List.of(event));

        List<AuditEventView> result = service.list("care", memberId, 2, 25);

        assertThat(result).hasSize(1);
        Pageable captured = pageableCaptor.getValue();
        assertThat(captured.getPageNumber()).isEqualTo(2);
        assertThat(captured.getPageSize()).isEqualTo(25);
    }

    @Test
    @DisplayName("list with invalid pagination sanitizes page and size")
    void listSanitizesPagination() {
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);

        when(repository.findFiltered(eq(familyId), eq(null), eq(null), pageableCaptor.capture()))
                .thenReturn(List.of());

        service.list(null, null, -1, 0);

        Pageable captured = pageableCaptor.getValue();
        assertThat(captured.getPageNumber()).isEqualTo(0);
        assertThat(captured.getPageSize()).isEqualTo(50);
    }

    @Test
    @DisplayName("listPaged returns Page of mapped views")
    void listPagedReturnsMappedPage() {
        AuditEvent event = sampleEvent("finance", memberId, "Added", "Expense");
        Page<AuditEvent> eventPage = new PageImpl<>(List.of(event), PageRequest.of(0, 10), 1);

        when(repository.findFilteredPaged(eq(familyId), eq("finance"), eq(memberId), any(Pageable.class)))
                .thenReturn(eventPage);

        Page<AuditEventView> result = service.listPaged("finance", memberId, PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).category()).isEqualTo("finance");
        assertThat(result.getContent().get(0).action()).isEqualTo("Added");
    }
}
