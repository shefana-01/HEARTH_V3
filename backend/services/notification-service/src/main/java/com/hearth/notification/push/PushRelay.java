package com.hearth.notification.push;

import com.hearth.common.text.Formats;
import io.micrometer.core.instrument.MeterRegistry;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.interfaces.ECPrivateKey;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends queued pushes. Each run locks a batch ({@code for update skip locked}, so several instances can run
 * side by side), sends each message, and deletes it on success. A push service that says the subscription
 * is gone (404, 410) removes the subscription; other failures are retried with a growing pause, six times.
 */
@Component
@ConditionalOnExpression("'${hearth.push.public-key:}' != '' and '${hearth.push.private-key:}' != '' and ${hearth.push.relay:true}")
public class PushRelay {

    private static final Logger log = LoggerFactory.getLogger(PushRelay.class);
    static final int BATCH = 50;
    static final int MAX_ATTEMPTS = 6;
    /** How long a push service should keep a message for a device that is offline. */
    static final Duration TTL = Duration.ofHours(12);

    private final PushProperties properties;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final HttpClient http;
    private final ECPrivateKey vapidKey;

    private final MeterRegistry meters;

    public PushRelay(PushProperties properties, JdbcTemplate jdbc, TransactionTemplate transactions, Clock clock, MeterRegistry meters) throws GeneralSecurityException {
        this.meters = meters;
        this.properties = properties;
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.clock = clock;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
        this.vapidKey = WebPushCrypto.decodePrivateKey(properties.privateKey());
    }

    private record Due(UUID id, String payload, int attempts, UUID subscriptionId, String endpoint, String p256dh, String auth) {
    }

    @Scheduled(fixedDelayString = "${hearth.push.relay-interval-ms:2000}")
    public void deliver() {
        transactions.executeWithoutResult(status -> {
            List<Due> due = jdbc.query("""
                    select m.id, m.payload, m.attempts, s.id as sid, s.endpoint, s.p256dh, s.auth
                    from push_message m join push_subscription s on s.id = m.subscription_id
                    where m.next_attempt_at <= ?
                    order by m.next_attempt_at
                    limit ?
                    for update of m skip locked
                    """, (rs, i) -> new Due(rs.getObject("id", UUID.class), rs.getString("payload"), rs.getInt("attempts"), rs.getObject("sid", UUID.class),
                    rs.getString("endpoint"), rs.getString("p256dh"), rs.getString("auth")), Timestamp.from(Instant.now(clock)), BATCH);
            for (Due message : due) {
                send(message);
            }
        });
    }

    private void send(Due message) {
        Instant now = Instant.now(clock);
        int status;
        String error = null;
        try {
            byte[] body = WebPushCrypto.encrypt(message.payload().getBytes(StandardCharsets.UTF_8), message.p256dh(), message.auth());
            HttpRequest request = HttpRequest.newBuilder(URI.create(message.endpoint()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/octet-stream")
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", String.valueOf(TTL.toSeconds()))
                    .header("Urgency", "normal")
                    .header("Authorization", Vapid.authorization(message.endpoint(), properties.subject(), properties.publicKey(), vapidKey, now))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            status = response.statusCode();
            if (status >= 300) {
                error = status + " " + Formats.clip(response.body(), 200);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return;
        } catch (Exception ex) {
            status = -1;
            error = Formats.clip(ex.getClass().getSimpleName() + ": " + ex.getMessage(), 250);
        }

        meters.counter("hearth.push.sent", "outcome", status >= 200 && status < 300 ? "delivered" : status == 404 || status == 410 ? "gone" : "failed").increment();
        if (status >= 200 && status < 300) {
            jdbc.update("delete from push_message where id = ?", message.id());
            jdbc.update("update push_subscription set last_used_at = ? where id = ?", Timestamp.from(now), message.subscriptionId());
        } else if (status == 404 || status == 410) {
            // The browser unsubscribed or the subscription expired: forget the device (its messages go with it).
            log.info("Push subscription {} is gone ({}); removing it", message.subscriptionId(), status);
            jdbc.update("delete from push_subscription where id = ?", message.subscriptionId());
        } else if (message.attempts() + 1 >= MAX_ATTEMPTS || status == 400 || status == 413) {
            log.warn("Giving up on push {} after {} attempts: {}", message.id(), message.attempts() + 1, error);
            jdbc.update("delete from push_message where id = ?", message.id());
        } else {
            long pause = Math.min(3600, 30L << message.attempts());
            jdbc.update("update push_message set attempts = attempts + 1, next_attempt_at = ?, last_error = ? where id = ?",
                    Timestamp.from(now.plusSeconds(pause)), error, message.id());
        }
    }

    /** For tests: the queued pushes. */
    List<Map<String, Object>> queued() {
        return jdbc.queryForList("select * from push_message");
    }
}
