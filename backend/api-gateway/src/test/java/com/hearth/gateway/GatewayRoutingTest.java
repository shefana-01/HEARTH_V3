package com.hearth.gateway;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.anyUrl;
import static com.github.tomakehurst.wiremock.client.WireMock.any;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.stubFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.verify;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cloud.contract.wiremock.AutoConfigureWireMock;
import org.springframework.test.web.reactive.server.WebTestClient;

/** Every public path reaches a service (here one stand-in for all of them); internal paths never do. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "FAMILY_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "TASK_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "DECISION_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "CARE_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "NOTIFICATION_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "AUDIT_SERVICE_URL=http://localhost:${wiremock.server.port}",
        "CORS_ALLOWED_ORIGINS=http://localhost:5173"
})
@AutoConfigureWireMock(port = 0)
@AutoConfigureWebTestClient
class GatewayRoutingTest {

    @Autowired
    WebTestClient web;

    @LocalServerPort
    int port;

    @BeforeEach
    void backend() {
        stubFor(any(anyUrl()).willReturn(aResponse().withStatus(200).withHeader("Content-Type", "application/json").withBody("[]")));
    }

    @Test
    void everyPublicAreaIsRouted() {
        String[] paths = {
            "/api/v1/auth/session", "/api/v1/account", "/api/v1/family", "/api/v1/members/123/availability", "/api/v1/invites/HEARTH-ABC123",
            "/api/v1/tasks", "/api/v1/events?memberId=1", "/api/v1/unavailability",
            "/api/v1/decisions/my-day", "/api/v1/reassignment-requests", "/api/v1/schedule/events?from=a&to=b",
            "/api/v1/appointments", "/api/v1/health/profiles", "/api/v1/groceries", "/api/v1/documents", "/api/v1/caregraph",
            "/api/v1/notifications/unread-count", "/api/v1/messages?channel=family", "/api/v1/audit-events"
        };
        for (String path : paths) {
            web.get().uri(path).exchange().expectStatus().isOk();
            verify(getRequestedFor(urlEqualTo(path)));
        }
    }

    @Test
    void internalAndUnknownPathsAreNotReachableFromOutside() {
        web.get().uri("/api/v1/internal/context").exchange().expectStatus().isNotFound();
        web.get().uri("/api/v1/internal/planning").exchange().expectStatus().isNotFound();
        web.get().uri("/actuator/env").exchange().expectStatus().isNotFound();
        web.get().uri("/api/v2/tasks").exchange().expectStatus().isNotFound();
    }

    @Test
    void eachRequestGetsAnIdAndTheWebAppMayCall() {
        web.get().uri("/api/v1/tasks").exchange().expectHeader().exists("X-Request-Id");
        web.get().uri("/api/v1/tasks").header("X-Request-Id", "abc-123").exchange().expectHeader().valueEquals("X-Request-Id", "abc-123");
    }

    /** Over real HTTP: the test client leaves out the host that the CORS check compares the origin with. */
    @Test
    void onlyTheWebAppsAddressMayCallFromABrowser() throws Exception {
        HttpResponse<Void> allowed = preflight("http://localhost:5173");
        assertThat(allowed.statusCode()).isEqualTo(200);
        assertThat(allowed.headers().firstValue("Access-Control-Allow-Origin")).hasValue("http://localhost:5173");
        assertThat(preflight("https://evil.example").statusCode()).isEqualTo(403);
    }

    private HttpResponse<Void> preflight(String origin) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/tasks"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", origin)
                .header("Access-Control-Request-Method", "POST")
                .build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());
    }
}
