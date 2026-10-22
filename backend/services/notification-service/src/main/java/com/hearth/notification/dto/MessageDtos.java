package com.hearth.notification.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

/** Shapes for the family chat and task comments. They match the frontend's {@code Message}. */
public final class MessageDtos {

    private MessageDtos() {
    }

    /** {@code authorId} is null for lines Hearth writes itself; kind is text, status or system. */
    public record MessageView(UUID id, String channel, UUID authorId, String kind, String text, Instant createdAt) {
    }

    public record NewMessage(@NotBlank(message = "Choose a conversation.") String channel, String text) {
    }

    public record ChannelRequest(@NotBlank(message = "Choose a conversation.") String channel) {
    }

    public record UnreadCount(long unread) {
    }
}
