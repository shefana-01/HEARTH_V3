package com.hearth.notification.api;

import com.hearth.notification.application.ChatService;
import com.hearth.notification.dto.MessageDtos.ChannelRequest;
import com.hearth.notification.dto.MessageDtos.MessageView;
import com.hearth.notification.dto.MessageDtos.NewMessage;
import com.hearth.notification.dto.MessageDtos.UnreadCount;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The family chat ({@code channel=family}) and task comments ({@code channel=task:<id>}). */
@RestController
@RequestMapping("/api/v1/messages")
public class MessageController {

    private final ChatService chat;

    public MessageController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping
    public List<MessageView> list(@RequestParam String channel, @RequestParam(required = false) Instant after) {
        return chat.list(channel, after);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageView send(@Valid @RequestBody NewMessage message) {
        return chat.send(message.channel(), message.text());
    }

    @PostMapping("/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@Valid @RequestBody ChannelRequest request) {
        chat.markRead(request.channel());
    }

    /** Polled by the browser every 20 seconds. */
    @GetMapping("/unread-count")
    public UnreadCount unreadCount() {
        return new UnreadCount(chat.unreadCount());
    }

    @GetMapping("/task-counts")
    public Map<String, Long> taskCounts() {
        return chat.countByTask();
    }
}
