package com.hearth.notification.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

/** Matches the frontend's {@code NotificationItem}; {@code forId} is the one member it is addressed to, absent for the whole family. */
public record NotificationView(
        UUID id,
        String type,
        String message,
        Instant createdAt,
        boolean read,
        @JsonInclude(JsonInclude.Include.NON_NULL) String href,
        @JsonInclude(JsonInclude.Include.NON_NULL) UUID forId) {
}
