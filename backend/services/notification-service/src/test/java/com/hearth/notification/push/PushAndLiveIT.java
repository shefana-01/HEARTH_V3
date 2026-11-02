package com.hearth.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.events.Events;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.testing.FakeFamilyDirectory;
import com.hearth.common.testing.TestFamilyConfig;
import com.hearth.notification.events.NotificationEventListener;
import com.hearth.notification.live.LiveEventListener;
import com.sun.net.httpserver.HttpServer;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Web Push end to end against a real PostgreSQL and a stand-in push service: subscriptions, who gets a push,
 * the encrypted message a browser receives, and the live-update stream.
 */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "spring.kafka.listener.auto-startup=false", "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false",
        "hearth.push.require-https=false", "hearth.push.allowed-hosts=127.0.0.1", "hearth.push.relay-interval-ms=3600000"
})
@AutoConfigureMockMvc
@Import(TestFamilyConfig.class)
class PushAndLiveIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    record Received(Map<String, String> headers, byte[] body) {
    }

    static final List<Received> received = new CopyOnWriteArrayList<>();
    static final AtomicInteger answer = new AtomicInteger(201);
    static final HttpServer pushService = start();
    static final KeyPair vapid = keys();

    @DynamicPropertySource
    static void vapidKeys(DynamicPropertyRegistry registry) {
        registry.add("hearth.push.public-key", () -> WebPushCrypto.b64(WebPushCrypto.encodePublicKey((ECPublicKey) vapid.getPublic())));
        registry.add("hearth.push.private-key", () -> WebPushCrypto.b64(unsigned(((ECPrivateKey) vapid.getPrivate()).getS().toByteArray())));
    }

    @AfterAll
    static void stop() {
        pushService.stop(0);
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    FakeFamilyDirectory family;

    @Autowired
    NotificationEventListener listener;

    @Autowired
    LiveEventListener liveListener;

    @Autowired
    PushRelay relay;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    ServiceClient services;

    UUID afsara;
    UUID rafid;

    /** A browser: its key pair and auth secret, as PushManager.subscribe() creates them. */
    record Browser(KeyPair keys, byte[] auth, String endpoint) {
        Map<String, Object> subscription() {
            return Map.of("endpoint", endpoint, "keys", Map.of("p256dh", WebPushCrypto.b64(WebPushCrypto.encodePublicKey((ECPublicKey) keys.getPublic())), "auth", WebPushCrypto.b64(auth)));
        }

        String read(byte[] body) throws Exception {
            return new String(WebPushCrypto.decrypt(body, (ECPrivateKey) keys.getPrivate(), (ECPublicKey) keys.getPublic(), auth), StandardCharsets.UTF_8);
        }
    }

    @BeforeEach
    void setUp() {
        jdbc.update("delete from push_subscription");
        received.clear();
        answer.set(201);
        family.reset();
        afsara = family.addMember("Afsara Mannan", "lead");
        rafid = family.addMember("Rafid Mannan", "contributor");
        family.signInAs(afsara);
    }

    private Browser browser(String name) throws Exception {
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        return new Browser(WebPushCrypto.generateKeyPair(), auth, "http://127.0.0.1:" + pushService.getAddress().getPort() + "/push/" + name + "-" + UUID.randomUUID());
    }

    private JsonNode call(MockHttpServletRequestBuilder request, Object body, int expectedStatus) throws Exception {
        request.with(jwt());
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult result = mvc.perform(request).andReturn();
        String text = result.getResponse().getContentAsString();
        assertThat(result.getResponse().getStatus()).as("%s %s: %s", result.getRequest().getMethod(), result.getRequest().getRequestURI(), text).isEqualTo(expectedStatus);
        return text.isBlank() ? null : json.readTree(text);
    }

    @Test
    void onlyKnownPushServicesAndValidKeysAreAccepted() throws Exception {
        Browser phone = browser("phone");
        JsonNode status = call(get("/api/v1/notifications/push"), null, 200);
        assertThat(status.get("enabled").asBoolean()).isTrue();
        assertThat(status.get("publicKey").asText()).hasSize(87);

        Map<String, Object> internal = Map.of("endpoint", "http://169.254.169.254/latest/meta-data", "keys", phone.subscription().get("keys"));
        call(post("/api/v1/notifications/push/subscriptions"), internal, 422);
        call(post("/api/v1/notifications/push/subscriptions"), Map.of("endpoint", phone.endpoint(), "keys", Map.of("p256dh", "not-a-key", "auth", "x")), 422);

        call(post("/api/v1/notifications/push/subscriptions"), phone.subscription(), 204);
        call(post("/api/v1/notifications/push/subscriptions"), phone.subscription(), 204);
        assertThat(call(get("/api/v1/notifications/push"), null, 200).get("devices").asInt()).isEqualTo(1);

        family.signInAs(rafid);
        call(delete("/api/v1/notifications/push/subscriptions").param("endpoint", phone.endpoint()), null, 404);
        family.signInAs(afsara);
        call(delete("/api/v1/notifications/push/subscriptions").param("endpoint", phone.endpoint()), null, 204);
        assertThat(call(get("/api/v1/notifications/push"), null, 200).get("devices").asInt()).isZero();
    }

    @Test
    void aNotificationReachesOnlyTheRightDevicesEncryptedForEach() throws Exception {
        Browser afsaraPhone = browser("afsara");
        Browser rafidLaptop = browser("rafid");
        call(post("/api/v1/notifications/push/subscriptions"), afsaraPhone.subscription(), 204);
        family.signInAs(rafid);
        call(post("/api/v1/notifications/push/subscriptions"), rafidLaptop.subscription(), 204);

        listener.handle(Events.of("task.assigned", family.familyId(), afsara).notifyMember(rafid, "task", "Afsara asked you to do “Cook dinner”.", "/tasks/7").build());
        // Family-wide news about Afsara's own action goes to everyone but her.
        listener.handle(Events.of("task.created", family.familyId(), afsara).notify("task", "Afsara added “Buy rice”.", "/tasks/8").build());

        relay.deliver();

        assertThat(received).hasSize(2);
        assertThat(received).allMatch(r -> r.headers().get("Content-Encoding").equals("aes128gcm"))
                .allMatch(r -> r.headers().get("Authorization").startsWith("vapid t="))
                .allMatch(r -> r.headers().get("TTL").equals("43200"));
        List<String> messages = new java.util.ArrayList<>();
        for (Received r : received) {
            messages.add(rafidLaptop.read(r.body()));
        }
        assertThat(messages).anyMatch(m -> m.contains("Cook dinner") && m.contains("\"url\":\"/tasks/7\""))
                .anyMatch(m -> m.contains("Buy rice"));
        assertThat(jdbc.queryForObject("select count(*) from push_message", Integer.class)).isZero();
    }

    @Test
    void aSubscriptionThePushServiceForgotIsRemovedAndFailuresAreRetried() throws Exception {
        Browser phone = browser("phone");
        call(post("/api/v1/notifications/push/subscriptions"), phone.subscription(), 204);

        answer.set(503);
        listener.handle(Events.of("task.reminder", family.familyId(), null).notifyMember(afsara, "reminder", "Cook — starts at 5:00 PM.", "/tasks/2").build());
        relay.deliver();
        assertThat(jdbc.queryForObject("select attempts from push_message", Integer.class)).isEqualTo(1);

        jdbc.update("update push_message set next_attempt_at = now() - interval '1 second'");
        answer.set(410);
        relay.deliver();
        assertThat(jdbc.queryForObject("select count(*) from push_subscription", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from push_message", Integer.class)).isZero();
    }

    @Test
    void someoneWhoLeavesTheFamilyStopsGettingPushes() throws Exception {
        family.signInAs(rafid);
        call(post("/api/v1/notifications/push/subscriptions"), browser("rafid").subscription(), 204);
        listener.handle(Events.of("member.removed", family.familyId(), afsara).data("memberId", rafid.toString()).build());
        assertThat(jdbc.queryForObject("select count(*) from push_subscription", Integer.class)).isZero();
    }

    @Test
    void openPagesAreToldWhatChangedButNotTheDetails() throws Exception {
        MvcResult stream = mvc.perform(get("/api/v1/notifications/stream").with(jwt()).accept(MediaType.TEXT_EVENT_STREAM)).andReturn();
        assertThat(stream.getRequest().isAsyncStarted()).isTrue();

        listener.handle(Events.of("task.assigned", family.familyId(), rafid).notifyMember(afsara, "task", "Rafid asked you to do “Secret thing”.", "/tasks/9").build());
        liveListener.on(json.writeValueAsString(Events.of("appointment.created", family.familyId(), rafid).build()));
        liveListener.on(json.writeValueAsString(Events.of("task.created", UUID.randomUUID(), rafid).build()));

        String body = stream.getResponse().getContentAsString();
        assertThat(body).contains("event:ready", "event:change", "\"scopes\":[\"notifications\"]", "\"scopes\":[\"care\"]");
        assertThat(body).doesNotContain("Secret thing", "tasks/9", "\"tasks\"");
    }

    /* ───────── helpers ───────── */

    private static HttpServer start() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/push", exchange -> {
                byte[] body;
                try (InputStream in = exchange.getRequestBody()) {
                    body = in.readAllBytes();
                }
                Map<String, String> headers = new java.util.HashMap<>();
                exchange.getRequestHeaders().forEach((k, v) -> headers.put(k.substring(0, 1).toUpperCase() + k.substring(1), v.get(0)));
                headers.put("Content-Encoding", exchange.getRequestHeaders().getFirst("Content-Encoding"));
                headers.put("Authorization", exchange.getRequestHeaders().getFirst("Authorization"));
                headers.put("TTL", exchange.getRequestHeaders().getFirst("TTL"));
                received.add(new Received(headers, body));
                exchange.sendResponseHeaders(answer.get(), -1);
                exchange.close();
            });
            server.start();
            return server;
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static KeyPair keys() {
        try {
            return WebPushCrypto.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static byte[] unsigned(byte[] value) {
        if (value.length == 32) {
            return value;
        }
        byte[] out = new byte[32];
        int copy = Math.min(32, value.length);
        System.arraycopy(value, value.length - copy, out, 32 - copy, copy);
        return out;
    }
}
