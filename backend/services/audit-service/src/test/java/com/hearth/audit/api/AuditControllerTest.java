package com.hearth.audit.api;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hearth.audit.application.AuditService;
import com.hearth.audit.dto.AuditEventView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuditControllerTest {

    private MockMvc mvc;
    private AuditService service;

    private final UUID actorId = UUID.randomUUID();
    private final UUID eventId1 = UUID.randomUUID();
    private final UUID eventId2 = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = mock(AuditService.class);
        AuditController controller = new AuditController(service);
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private AuditEventView sampleView(UUID id, String category, String action, String subject) {
        return new AuditEventView(
                id,
                actorId,
                category,
                action,
                subject,
                Instant.now(),
                null,
                "New Value");
    }

    @Test
    @DisplayName("GET /api/v1/audit-events without parameters queries default list")
    void listWithoutParamsReturnsAll() throws Exception {
        AuditEventView item1 = sampleView(eventId1, "tasks", "Created a task", "Buy milk");
        AuditEventView item2 = sampleView(eventId2, "care", "Added appointment", "Dentist");

        when(service.list(eq(null), eq(null), eq(0), eq(500))).thenReturn(List.of(item1, item2));

        mvc.perform(get("/api/v1/audit-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(eventId1.toString()))
                .andExpect(jsonPath("$[0].category").value("tasks"))
                .andExpect(jsonPath("$[0].action").value("Created a task"))
                .andExpect(jsonPath("$[1].id").value(eventId2.toString()))
                .andExpect(jsonPath("$[1].category").value("care"));

        verify(service).list(null, null, 0, 500);
    }

    @Test
    @DisplayName("GET /api/v1/audit-events with category filter passes category to service")
    void listWithCategoryFilter() throws Exception {
        AuditEventView item = sampleView(eventId1, "circle", "Invited member", "new@example.com");

        when(service.list(eq("circle"), eq(null), anyInt(), anyInt())).thenReturn(List.of(item));

        mvc.perform(get("/api/v1/audit-events").param("category", "circle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].category").value("circle"))
                .andExpect(jsonPath("$[0].action").value("Invited member"));

        verify(service).list(eq("circle"), eq(null), eq(0), eq(500));
    }

    @Test
    @DisplayName("GET /api/v1/audit-events with actorId filter passes actor to service")
    void listWithActorIdFilter() throws Exception {
        AuditEventView item = sampleView(eventId1, "schedule", "Added time away", "Vacation");

        when(service.list(eq(null), eq(actorId), anyInt(), anyInt())).thenReturn(List.of(item));

        mvc.perform(get("/api/v1/audit-events").param("actorId", actorId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].actorId").value(actorId.toString()));

        verify(service).list(eq(null), eq(actorId), eq(0), eq(500));
    }

    @Test
    @DisplayName("GET /api/v1/audit-events with custom page and size passes pagination parameters")
    void listWithPagination() throws Exception {
        AuditEventView item = sampleView(eventId1, "tasks", "Completed task", "Clean kitchen");

        when(service.list(eq("tasks"), eq(actorId), eq(2), eq(25))).thenReturn(List.of(item));

        mvc.perform(get("/api/v1/audit-events")
                        .param("category", "tasks")
                        .param("actorId", actorId.toString())
                        .param("page", "2")
                        .param("size", "25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].subject").value("Clean kitchen"));

        verify(service).list("tasks", actorId, 2, 25);
    }

    @Test
    @DisplayName("GET /api/v1/audit-events returns empty array when no events match")
    void listReturnsEmptyArrayWhenNoMatches() throws Exception {
        when(service.list(eq("unknown"), eq(null), eq(0), eq(500))).thenReturn(List.of());

        mvc.perform(get("/api/v1/audit-events").param("category", "unknown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        verify(service).list("unknown", null, 0, 500);
    }
}
