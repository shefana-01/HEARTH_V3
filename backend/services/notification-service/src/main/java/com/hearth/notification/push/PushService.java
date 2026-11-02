package com.hearth.notification.push;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.text.Formats;
import com.hearth.notification.entity.Notification;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Subscriptions and the push outbox. A notification queues one push per device of each person who should
 * see it, in the same transaction that saves the notification; {@link PushRelay} sends them.
 */
@Service
public class PushService {

    private final PushProperties properties;
    private final PushSubscriptionRepository subscriptions;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final boolean includeOwnActions;

    public PushService(PushProperties properties, PushSubscriptionRepository subscriptions, JdbcTemplate jdbc, ObjectMapper mapper, Clock clock,
                       @Value("${hearth.notifications.include-own-actions:false}") boolean includeOwnActions) {
        this.properties = properties;
        this.subscriptions = subscriptions;
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.clock = clock;
        this.includeOwnActions = includeOwnActions;
    }

    public record PushConfig(boolean enabled, String publicKey) {
    }

    public PushConfig config() {
        return new PushConfig(properties.enabled(), properties.enabled() ? properties.publicKey() : null);
    }

    /** Saves (or moves to the caller) the subscription a browser created with our public key. */
    @Transactional
    public void subscribe(FamilyContext context, String endpoint, String p256dh, String auth, String userAgent) {
        if (!properties.enabled()) {
            throw ApiException.conflict("Push notifications are not set up on this Hearth.");
        }
        checkEndpoint(endpoint);
        try {
            if (WebPushCrypto.fromB64(auth).length != 16) {
                throw ApiException.unprocessable("The browser sent an invalid subscription.");
            }
            WebPushCrypto.decodePublicKey(WebPushCrypto.fromB64(p256dh));
        } catch (IllegalArgumentException | GeneralSecurityException ex) {
            throw ApiException.unprocessable("The browser sent an invalid subscription.");
        }
        String agent = Formats.clip(userAgent, 300);
        subscriptions.findByEndpoint(endpoint).ifPresentOrElse(
                existing -> existing.reassign(context.familyId(), context.memberId(), p256dh, auth, agent),
                () -> subscriptions.save(new PushSubscription(context.familyId(), context.memberId(), endpoint, p256dh, auth, agent, Instant.now(clock))));
    }

    /** Removes the caller's subscription for one device. Someone else's is left alone (and reported as not found). */
    @Transactional
    public void unsubscribe(FamilyContext context, String endpoint) {
        PushSubscription subscription = subscriptions.findByEndpoint(endpoint)
                .filter(s -> s.getMemberId().equals(context.memberId()))
                .orElseThrow(() -> ApiException.notFound("That device"));
        subscriptions.delete(subscription);
    }

    @Transactional(readOnly = true)
    public int deviceCount(FamilyContext context) {
        return subscriptions.findByFamilyIdAndMemberId(context.familyId(), context.memberId()).size();
    }

    /** Queues a push for every device that should show this notification. Called inside the notification's transaction. */
    @Transactional
    public int enqueue(Notification n) {
        if (!properties.enabled()) {
            return 0;
        }
        List<PushSubscription> targets = n.getRecipientMemberId() != null
                ? subscriptions.findByFamilyIdAndMemberId(n.getFamilyId(), n.getRecipientMemberId())
                : subscriptions.findByFamilyId(n.getFamilyId()).stream()
                        .filter(s -> includeOwnActions || n.getActorMemberId() == null || !n.getActorMemberId().equals(s.getMemberId()))
                        .toList();
        if (targets.isEmpty()) {
            return 0;
        }
        String payload = payload(n);
        Instant now = Instant.now(clock);
        for (PushSubscription target : targets) {
            jdbc.update("insert into push_message (id, subscription_id, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, 0, ?)",
                    UUID.randomUUID(), target.getId(), payload, java.sql.Timestamp.from(now), java.sql.Timestamp.from(now));
        }
        return targets.size();
    }

    /** When someone leaves the family their devices stop receiving its notifications. */
    @Transactional
    public void memberLeft(UUID memberId) {
        subscriptions.deleteByMemberId(memberId);
    }

    private String payload(Notification n) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "Hearth");
        body.put("body", Formats.clip(n.getMessage(), 300));
        body.put("url", n.getHref() == null || !n.getHref().startsWith("/") ? "/notifications" : n.getHref());
        body.put("tag", n.getType());
        body.put("id", n.getId().toString());
        try {
            return mapper.writeValueAsString(body);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    void checkEndpoint(String endpoint) {
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw ApiException.unprocessable("The browser sent an invalid subscription.");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean secure = "https".equals(uri.getScheme()) || !properties.requireHttps() && "http".equals(uri.getScheme());
        boolean known = properties.allowedHosts().stream().anyMatch(allowed -> host.equals(allowed) || host.endsWith("." + allowed));
        if (!secure || !known || uri.getUserInfo() != null) {
            throw ApiException.unprocessable("That push service is not supported.");
        }
    }
}
