package com.hearth.notification.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.http.ServiceClient;
import com.hearth.notification.dto.MessageDtos.MessageView;
import com.hearth.notification.entity.ChannelRead;
import com.hearth.notification.entity.Message;
import com.hearth.notification.repository.ChannelReadRepository;
import com.hearth.notification.repository.MessageRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The family chat ({@code family}) and the comment thread under each task ({@code task:<id>}). A task's
 * thread is only open to people who can see the task, which task-service decides (asked as the caller).
 */
@Service
public class ChatService {

    public static final int MAX_LENGTH = 1000;
    private static final Pattern TASK_CHANNEL = Pattern.compile("^task:[0-9a-fA-F-]{36}$");

    private final FamilyDirectory directory;
    private final MessageRepository messages;
    private final ChannelReadRepository reads;
    private final ServiceClient services;
    private final String taskServiceUrl;

    public ChatService(FamilyDirectory directory, MessageRepository messages, ChannelReadRepository reads, ServiceClient services, @Value("${hearth.services.task}") String taskServiceUrl) {
        this.directory = directory;
        this.messages = messages;
        this.reads = reads;
        this.services = services;
        this.taskServiceUrl = taskServiceUrl;
    }

    /** Messages in a channel, oldest first; with {@code after}, only newer ones (used when polling). */
    @Transactional(readOnly = true)
    public List<MessageView> list(String channel, Instant after) {
        FamilyContext context = directory.context();
        requireAllowed(channel);
        List<Message> found = after == null
                ? messages.findByFamilyIdAndChannelOrderByCreatedAtAsc(context.familyId(), channel)
                : messages.findByFamilyIdAndChannelAndCreatedAtAfterOrderByCreatedAtAsc(context.familyId(), channel, after);
        return found.stream().map(ChatService::view).toList();
    }

    @Transactional
    public MessageView send(String channel, String rawText) {
        FamilyContext context = directory.context();
        requireAllowed(channel);
        String text = rawText == null ? "" : rawText.trim();
        if (text.isEmpty()) {
            throw ApiException.unprocessable("Write a message first.");
        }
        if (text.length() > MAX_LENGTH) {
            throw ApiException.unprocessable("Messages can be up to " + MAX_LENGTH + " characters.");
        }
        Message message = new Message();
        message.setId(UUID.randomUUID());
        message.setFamilyId(context.familyId());
        message.setChannel(channel);
        message.setAuthorId(context.memberId());
        message.setKind("text");
        message.setBody(text);
        message.setCreatedAt(Instant.now());
        messages.save(message);
        // Your own message means you have seen the conversation up to here.
        markRead(context, channel, message.getCreatedAt());
        return view(message);
    }

    /** Remembers that the caller has seen everything in the channel. */
    @Transactional
    public void markRead(String channel) {
        FamilyContext context = directory.context();
        requireAllowed(channel);
        markRead(context, channel, Instant.now());
    }

    /** Unread messages and status lines in the family chat, written by other people. */
    @Transactional(readOnly = true)
    public long unreadCount() {
        FamilyContext context = directory.context();
        Instant since = reads.findByFamilyIdAndMemberIdAndChannel(context.familyId(), context.memberId(), "family").map(ChannelRead::getLastReadAt).orElse(Instant.EPOCH);
        return messages.countUnread(context.familyId(), "family", context.memberId(), since);
    }

    /** How many comments each task the caller can see has, for the badge on a task. */
    @Transactional(readOnly = true)
    public Map<String, Long> countByTask() {
        FamilyContext context = directory.context();
        JsonNode visibleTasks = services.get(taskServiceUrl + "/api/v1/tasks?includeCancelled=true", JsonNode.class);
        Set<String> visible = new HashSet<>();
        for (JsonNode task : visibleTasks) {
            visible.add(task.path("id").asText());
        }
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : messages.countTextMessagesPerTaskChannel(context.familyId())) {
            String taskId = row[0].toString().substring("task:".length());
            if (visible.contains(taskId)) {
                counts.put(taskId, ((Number) row[1]).longValue());
            }
        }
        return counts;
    }

    private void markRead(FamilyContext context, String channel, Instant at) {
        ChannelRead read = reads.findByFamilyIdAndMemberIdAndChannel(context.familyId(), context.memberId(), channel).orElseGet(() -> {
            ChannelRead created = new ChannelRead();
            created.setId(UUID.randomUUID());
            created.setFamilyId(context.familyId());
            created.setMemberId(context.memberId());
            created.setChannel(channel);
            return created;
        });
        if (read.getLastReadAt() == null || at.isAfter(read.getLastReadAt())) {
            read.setLastReadAt(at);
        }
        reads.save(read);
    }

    /** The family chat is everyone's; a task thread only for people who can see the task (otherwise 404). */
    private void requireAllowed(String channel) {
        if ("family".equals(channel)) {
            return;
        }
        if (channel == null || !TASK_CHANNEL.matcher(channel).matches()) {
            throw ApiException.notFound("That conversation");
        }
        services.get(taskServiceUrl + "/api/v1/tasks/" + channel.substring("task:".length()), JsonNode.class);
    }

    static MessageView view(Message m) {
        return new MessageView(m.getId(), m.getChannel(), m.getAuthorId(), m.getKind(), m.getBody(), m.getCreatedAt());
    }
}
