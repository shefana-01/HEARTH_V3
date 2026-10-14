package com.hearth.audit.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

/** Matches the frontend's AuditEvent. */
public record AuditEventView(
        UUID id,
        UUID actorId,
        String category,
        String action,
        String subject,
        Instant at,
        @JsonInclude(JsonInclude.Include.NON_NULL) String before,
        @JsonInclude(JsonInclude.Include.NON_NULL) String after) {
}
