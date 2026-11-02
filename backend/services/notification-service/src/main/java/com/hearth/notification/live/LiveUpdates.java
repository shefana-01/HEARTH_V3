package com.hearth.notification.live;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The open live-update streams on this instance, by family. A message only says which parts of the app
 * changed ("tasks", "chat", ...), never what changed: the browser reloads through the normal APIs, which
 * apply every visibility rule. So a stream can never leak a private task or a restricted document.
 */
@Component
public class LiveUpdates implements MeterBinder {

    private static final Logger log = LoggerFactory.getLogger(LiveUpdates.class);
    static final Duration STREAM_TIMEOUT = Duration.ofMinutes(30);
    static final int MAX_STREAMS_PER_MEMBER = 5;

    record Client(UUID memberId, SseEmitter emitter) {
    }

    private final Map<UUID, Set<Client>> byFamily = new ConcurrentHashMap<>();

    /** Opens a stream for one member. The browser reconnects when it ends (timeout, deploy, network change). */
    public SseEmitter open(UUID familyId, UUID memberId) {
        Set<Client> clients = byFamily.computeIfAbsent(familyId, id -> new CopyOnWriteArraySet<>());
        List<Client> mine = clients.stream().filter(c -> c.memberId().equals(memberId)).toList();
        if (mine.size() >= MAX_STREAMS_PER_MEMBER) {
            // Many tabs: the oldest one gives way.
            close(familyId, mine.get(0));
        }
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT.toMillis());
        Client client = new Client(memberId, emitter);
        clients.add(client);
        emitter.onCompletion(() -> remove(familyId, client));
        emitter.onTimeout(() -> close(familyId, client));
        emitter.onError(ex -> remove(familyId, client));
        send(familyId, client, "ready", "{\"scopes\":[]}");
        return emitter;
    }

    /**
     * Tells a family's open streams that parts of the app changed.
     *
     * @param onlyMember when set, only that member's streams are told (for example a notification addressed to them)
     */
    public void publish(UUID familyId, Set<String> scopes, UUID onlyMember) {
        Set<Client> clients = byFamily.get(familyId);
        if (clients == null || clients.isEmpty() || scopes.isEmpty()) {
            return;
        }
        String data = "{\"scopes\":[" + String.join(",", scopes.stream().sorted().map(s -> "\"" + s + "\"").toList()) + "]}";
        for (Client client : clients) {
            if (onlyMember == null || onlyMember.equals(client.memberId())) {
                send(familyId, client, "change", data);
            }
        }
    }

    /** Like {@link #publish}, but only once the current transaction has committed (so a reload sees the change). */
    public void publishAfterCommit(UUID familyId, Set<String> scopes, UUID onlyMember) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(familyId, scopes, onlyMember);
                }
            });
        } else {
            publish(familyId, scopes, onlyMember);
        }
    }

    /** A comment line every 25 seconds keeps proxies from closing an idle stream and finds dead ones. */
    @Scheduled(fixedDelay = 25_000)
    public void heartbeat() {
        byFamily.forEach((familyId, clients) -> clients.forEach(client -> {
            try {
                client.emitter().send(SseEmitter.event().comment("keep-alive"));
            } catch (IOException | IllegalStateException ex) {
                remove(familyId, client);
            }
        }));
    }

    public int openStreams() {
        return byFamily.values().stream().mapToInt(Set::size).sum();
    }

    @Override
    public void bindTo(MeterRegistry registry) {
        Gauge.builder("hearth.live.streams", this, LiveUpdates::openStreams).description("Open live-update streams on this instance").register(registry);
    }

    private void send(UUID familyId, Client client, String name, String data) {
        try {
            client.emitter().send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException ex) {
            log.debug("Live stream closed: {}", ex.getMessage());
            remove(familyId, client);
        }
    }

    private void close(UUID familyId, Client client) {
        remove(familyId, client);
        try {
            client.emitter().complete();
        } catch (IllegalStateException ignored) {
            // already finished
        }
    }

    private void remove(UUID familyId, Client client) {
        byFamily.computeIfPresent(familyId, (id, clients) -> {
            clients.remove(client);
            return clients.isEmpty() ? null : clients;
        });
    }
}
