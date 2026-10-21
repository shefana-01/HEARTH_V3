package com.hearth.family;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.http.ServiceClient;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The family-service API end to end against a real PostgreSQL (in Docker), using the service's own
 * tokens. Kafka and the mail server are not needed: events and emails are read from their outbox tables.
 */
@Tag("docker")
@Testcontainers
@SpringBootTest(properties = {
        "hearth.outbox.relay=false",
        "hearth.mail.poll-ms=3600000",
        "hearth.auth.requests-per-minute=1000",
        "spring.kafka.bootstrap-servers=localhost:1", "spring.kafka.admin.auto-create=false"
})
@AutoConfigureMockMvc
class FamilyApiIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String PASSWORD = "Sunrise#2026";
    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_%-]+)");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    ServiceClient services;

    @BeforeEach
    void noAppointments() {
        when(services.get(anyString(), any(ParameterizedTypeReference.class))).thenReturn(List.of());
    }

    /* ───────── helpers ───────── */

    record Session(String token, String refreshToken, JsonNode body) {
    }

    private JsonNode call(MockHttpServletRequestBuilder request, String token, Object body, int expectedStatus) throws Exception {
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult result = mvc.perform(request).andReturn();
        String text = result.getResponse().getContentAsString();
        assertThat(result.getResponse().getStatus()).as("status of %s %s: %s", result.getRequest().getMethod(), result.getRequest().getRequestURI(), text).isEqualTo(expectedStatus);
        return text.isBlank() ? null : json.readTree(text);
    }

    private static String email(String name) {
        return name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private Session signUp(String name, String email) throws Exception {
        JsonNode body = call(post("/api/v1/auth/sign-up"), null, Map.of("name", name, "email", email, "password", PASSWORD), 201);
        return new Session(body.get("token").asText(), body.get("refreshToken").asText(), body);
    }

    private JsonNode createFamily(Session session, List<Map<String, Object>> invites) throws Exception {
        Map<String, Object> request = Map.of(
                "name", "The Test Family",
                "location", "Dhaka",
                "myRelation", "Daughter",
                "dependants", List.of(Map.of("name", "Rahima Khatun", "relation", "Grandmother", "notes", "")),
                "invites", invites,
                "availability", Map.of("days", List.of(true, true, true, true, true, false, false), "windows", List.of(Map.of("id", "w1", "label", "Evening", "start", "17:00", "end", "21:00"))),
                "timezone", "Asia/Dhaka");
        return call(post("/api/v1/family"), session.token(), request, 201);
    }

    /** The secret in the newest email to this address (we read the outbox instead of a mailbox). */
    private String tokenFromLatestEmail(String to, String subjectStart) {
        String body = jdbc.queryForObject("select body from email_outbox where lower(to_address) = lower(?) and subject like ? order by created_at desc limit 1", String.class, to, subjectStart + "%");
        Matcher matcher = TOKEN.matcher(body);
        assertThat(matcher.find()).as("email has a link with a token").isTrue();
        return java.net.URLDecoder.decode(matcher.group(1), java.nio.charset.StandardCharsets.UTF_8);
    }

    private List<String> outboxEventTypes() {
        return jdbc.queryForList("select event_type from outbox_event order by created_at", String.class);
    }

    /* ───────── tests ───────── */

    @Test
    void signUpGivesASessionWithoutAFamilyAndSendsAConfirmationEmail() throws Exception {
        String address = email("asha");
        Session session = signUp("Asha Rahman", address);

        JsonNode account = session.body().get("session").get("account");
        assertThat(session.body().get("session").get("hasFamily").asBoolean()).isFalse();
        assertThat(session.body().get("session").get("isSample").asBoolean()).isFalse();
        assertThat(account.get("memberId").isNull()).isTrue();
        assertThat(account.get("emailVerified").asBoolean()).isFalse();
        assertThat(account.get("name").asText()).isEqualTo("Asha Rahman");

        JsonNode current = call(get("/api/v1/auth/session"), session.token(), null, 200);
        assertThat(current.get("account").get("email").asText()).isEqualTo(address);

        String token = tokenFromLatestEmail(address, "Confirm your email");
        call(post("/api/v1/auth/verify-email"), null, Map.of("token", token), 204);
        assertThat(call(get("/api/v1/account"), session.token(), null, 200).get("emailVerified").asBoolean()).isTrue();
        // A link works once.
        call(post("/api/v1/auth/verify-email"), null, Map.of("token", token), 410);
    }

    @Test
    void passwordsMustFollowTheRulesAndEmailsAreUniqueIgnoringCase() throws Exception {
        JsonNode weak = call(post("/api/v1/auth/sign-up"), null, Map.of("name", "Weak", "email", email("weak"), "password", "password"), 422);
        assertThat(weak.get("detail").asText()).isEqualTo("Password needs 1 number or symbol, 1 uppercase letter.");

        String address = email("dup");
        signUp("First", address);
        JsonNode duplicate = call(post("/api/v1/auth/sign-up"), null, Map.of("name", "Second", "email", address.toUpperCase(), "password", PASSWORD), 409);
        assertThat(duplicate.get("detail").asText()).contains("already exists");
    }

    @Test
    void wrongPasswordsGetOneGenericMessageAndFiveInARowPauseSignIn() throws Exception {
        String address = email("lock");
        signUp("Lock Test", address);

        JsonNode unknown = call(post("/api/v1/auth/sign-in"), null, Map.of("email", email("nobody"), "password", PASSWORD), 401);
        JsonNode wrong = call(post("/api/v1/auth/sign-in"), null, Map.of("email", address, "password", "Wrong#2026"), 401);
        assertThat(unknown.get("detail").asText()).isEqualTo(wrong.get("detail").asText());

        for (int i = 0; i < 4; i++) {
            call(post("/api/v1/auth/sign-in"), null, Map.of("email", address, "password", "Wrong#2026"), 401);
        }
        call(post("/api/v1/auth/sign-in"), null, Map.of("email", address, "password", PASSWORD), 429);
    }

    @Test
    void aRefreshTokenWorksOnceAndReusingItEndsEverySession() throws Exception {
        String address = email("refresh");
        Session session = signUp("Refresh Test", address);

        JsonNode pair = call(post("/api/v1/auth/refresh"), null, Map.of("refreshToken", session.refreshToken()), 200);
        String newRefresh = pair.get("refreshToken").asText();
        call(get("/api/v1/auth/session"), pair.get("token").asText(), null, 200);

        // The old token again: it was copied. Both the old and the new one stop working.
        call(post("/api/v1/auth/refresh"), null, Map.of("refreshToken", session.refreshToken()), 401);
        call(post("/api/v1/auth/refresh"), null, Map.of("refreshToken", newRefresh), 401);
    }

    @Test
    void signingOutEndsTheRefreshToken() throws Exception {
        Session session = signUp("Sign Out", email("out"));
        call(post("/api/v1/auth/sign-out"), null, Map.of("refreshToken", session.refreshToken()), 204);
        call(post("/api/v1/auth/refresh"), null, Map.of("refreshToken", session.refreshToken()), 401);
    }

    @Test
    void requestsWithoutAValidTokenGetA401ProblemDocument() throws Exception {
        JsonNode missing = call(get("/api/v1/family"), null, null, 401);
        assertThat(missing.get("detail").asText()).isNotBlank();
        call(get("/api/v1/family"), "not-a-token", null, 401);
        JsonNode jwks = call(get("/.well-known/jwks.json"), null, null, 200);
        assertThat(jwks.get("keys").get(0).get("kty").asText()).isEqualTo("RSA");
        assertThat(jwks.get("keys").get(0).has("d")).as("private part never published").isFalse();
    }

    @Test
    void creatingAFamilyMakesTheCallerItsOrganiser() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        call(get("/api/v1/family"), lead.token(), null, 204);

        JsonNode family = createFamily(lead, List.of());
        assertThat(family.get("timezone").asText()).isEqualTo("Asia/Dhaka");
        assertThat(family.get("inviteCode").asText()).matches("HEARTH-[A-Z0-9]{6}");
        assertThat(family.get("dependants")).hasSize(1);
        call(post("/api/v1/family"), lead.token(), Map.of("name", "Again"), 409);

        JsonNode session = call(get("/api/v1/auth/session"), lead.token(), null, 200);
        assertThat(session.get("hasFamily").asBoolean()).isTrue();
        String memberId = session.get("account").get("memberId").asText();

        JsonNode members = call(get("/api/v1/members"), lead.token(), null, 200);
        assertThat(members).hasSize(1);
        JsonNode me = members.get(0);
        assertThat(me.get("id").asText()).isEqualTo(memberId);
        assertThat(me.get("role").asText()).isEqualTo("lead");
        assertThat(me.get("relation").asText()).isEqualTo("Daughter");
        assertThat(me.get("access").get("medical").asBoolean()).isTrue();
        assertThat(me.get("availability").get("windows").get(0).get("start").asText()).isEqualTo("17:00");

        JsonNode context = call(get("/api/v1/internal/context"), lead.token(), null, 200);
        assertThat(context.get("memberId").asText()).isEqualTo(memberId);
        assertThat(context.get("timezone").asText()).isEqualTo("Asia/Dhaka");
        assertThat(context.get("role").asText()).isEqualTo("lead");
        assertThat(outboxEventTypes()).contains("family.created");
    }

    @Test
    void anInvitedPersonJoinsWithTheCodeOnceTheyConfirmTheirEmail() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        String rafidEmail = email("rafid");
        JsonNode family = createFamily(lead, List.of(Map.of("name", "Rafid Mannan", "email", rafidEmail, "relation", "Brother", "role", "contributor")));
        String code = family.get("inviteCode").asText();
        assertThat(tokenFromLatestEmailExists(rafidEmail)).isTrue();

        Session rafid = signUp("Rafid Mannan", rafidEmail.toUpperCase());
        JsonNode lookup = call(get("/api/v1/invites/" + code.toLowerCase()), rafid.token(), null, 200);
        assertThat(lookup.get("inviterName").asText()).isEqualTo("Afsara Mannan");
        assertThat(lookup.get("memberCount").asInt()).isEqualTo(1);
        assertThat(lookup.get("alreadyMember").asBoolean()).isFalse();

        JsonNode notConfirmed = call(post("/api/v1/invites/" + code + "/accept"), rafid.token(), null, 403);
        assertThat(notConfirmed.get("detail").asText()).contains("Confirm your email");

        call(post("/api/v1/auth/verify-email"), null, Map.of("token", tokenFromLatestEmail(rafidEmail, "Confirm your email")), 204);
        call(post("/api/v1/invites/" + code + "/accept"), rafid.token(), null, 200);
        call(post("/api/v1/invites/" + code + "/accept"), rafid.token(), null, 200); // joining twice is harmless

        JsonNode members = call(get("/api/v1/members"), lead.token(), null, 200);
        assertThat(members).hasSize(2);
        assertThat(members.get(1).get("status").asText()).isEqualTo("active");
        assertThat(call(get("/api/v1/auth/session"), rafid.token(), null, 200).get("hasFamily").asBoolean()).isTrue();

        // Someone who was not invited cannot join, even with the code.
        Session stranger = signUp("Stranger", email("stranger"));
        call(post("/api/v1/auth/verify-email"), null, Map.of("token", tokenFromLatestEmail(stranger.body().get("session").get("account").get("email").asText(), "Confirm your email")), 204);
        JsonNode refused = call(post("/api/v1/invites/" + code + "/accept"), stranger.token(), null, 403);
        assertThat(refused.get("detail").asText()).contains("hasn’t invited");

        call(get("/api/v1/invites/NOT-A-CODE"), stranger.token(), null, 422);
        call(get("/api/v1/invites/HEARTH-ZZZZZZ"), stranger.token(), null, 404);
    }

    private boolean tokenFromLatestEmailExists(String to) {
        return jdbc.queryForObject("select count(*) from email_outbox where lower(to_address) = lower(?) and subject like '%invited you%'", Integer.class, to) == 1;
    }

    @Test
    void onlyTheOrganiserInvitesAndManagesRolesAndAccess() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        String nazmunEmail = email("nazmun");
        JsonNode family = createFamily(lead, List.of(Map.of("name", "Nazmun Nahar", "email", nazmunEmail, "relation", "Mother", "role", "contributor")));
        Session nazmun = signUp("Nazmun Nahar", nazmunEmail);
        call(post("/api/v1/auth/verify-email"), null, Map.of("token", tokenFromLatestEmail(nazmunEmail, "Confirm your email")), 204);
        call(post("/api/v1/invites/" + family.get("inviteCode").asText() + "/accept"), nazmun.token(), null, 200);

        String leadId = call(get("/api/v1/auth/session"), lead.token(), null, 200).get("account").get("memberId").asText();
        String nazmunId = call(get("/api/v1/auth/session"), nazmun.token(), null, 200).get("account").get("memberId").asText();

        call(post("/api/v1/members"), nazmun.token(), Map.of("name", "Kamal", "email", email("kamal"), "relation", "Father", "role", "contributor"), 403);
        JsonNode invited = call(post("/api/v1/members"), lead.token(), Map.of("name", "Kamal", "email", email("kamal"), "relation", "Father", "role", "contributor"), 201);
        assertThat(invited.get("status").asText()).isEqualTo("invited");
        call(post("/api/v1/members"), lead.token(), Map.of("name", "Again", "email", nazmunEmail, "relation", "", "role", "contributor"), 409);

        // Everyone edits themselves; only the organiser changes roles and access.
        JsonNode own = call(patch("/api/v1/members/" + nazmunId), nazmun.token(), Map.of("focus", "Groceries & cooking", "skills", List.of("meals", "errands")), 200);
        assertThat(own.get("focus").asText()).isEqualTo("Groceries & cooking");
        call(patch("/api/v1/members/" + nazmunId), nazmun.token(), Map.of("role", "observer"), 403);
        call(patch("/api/v1/members/" + leadId), nazmun.token(), Map.of("focus", "x"), 403);
        call(patch("/api/v1/members/" + nazmunId), nazmun.token(), Map.of("skills", List.of("flying")), 422);
        JsonNode promoted = call(patch("/api/v1/members/" + nazmunId), lead.token(), Map.of("access", Map.of("schedule", true, "medical", true, "documents", false)), 200);
        assertThat(promoted.get("access").get("medical").asBoolean()).isTrue();
        call(patch("/api/v1/members/" + leadId), lead.token(), Map.of("role", "observer"), 409);

        // Availability: own or the organiser's; windows are checked.
        Map<String, Object> bad = Map.of("days", List.of(true, true, true, true, true, true, true), "windows", List.of(Map.of("id", "x", "label", "", "start", "18:00", "end", "09:00")));
        call(put("/api/v1/members/" + nazmunId + "/availability"), nazmun.token(), bad, 422);
        call(put("/api/v1/members/" + leadId + "/availability"), nazmun.token(), Map.of("days", List.of(true, true, true, true, true, true, true), "windows", List.of()), 403);

        // The organiser cannot be removed; others can, by the organiser only.
        call(delete("/api/v1/members/" + leadId), lead.token(), null, 409);
        call(delete("/api/v1/members/" + invited.get("id").asText()), nazmun.token(), null, 403);
        call(delete("/api/v1/members/" + invited.get("id").asText()), lead.token(), null, 204);
        assertThat(outboxEventTypes()).contains("member.invited", "member.joined", "member.updated", "member.removed");
    }

    @Test
    void aStatusLineShowsInTheChatAndEndsByItself() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        createFamily(lead, List.of());
        String me = call(get("/api/v1/auth/session"), lead.token(), null, 200).get("account").get("memberId").asText();

        Instant until = Instant.now().plus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        JsonNode member = call(put("/api/v1/members/" + me + "/status"), lead.token(), Map.of("text", "  In class until 2  ", "until", until.toString()), 200);
        assertThat(member.get("statusNote").get("text").asText()).isEqualTo("In class until 2");
        String payload = jdbc.queryForObject("select payload from outbox_event where event_type = 'member.status-changed' order by created_at desc limit 1", String.class);
        assertThat(json.readTree(payload).get("chat").get("kind").asText()).isEqualTo("status");

        call(put("/api/v1/members/" + me + "/status"), lead.token(), Map.of("text", "Back soon", "until", Instant.now().minusSeconds(60).toString()), 422);
        JsonNode cleared = call(put("/api/v1/members/" + me + "/status"), lead.token(), Map.of("text", ""), 200);
        assertThat(cleared.has("statusNote")).isFalse();
    }

    @Test
    void familyDetailsAndPeopleTheFamilyLooksAfter() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        createFamily(lead, List.of());

        JsonNode updated = call(patch("/api/v1/family"), lead.token(), Map.of("weeklyGroceryBudget", 4500), 200);
        assertThat(updated.get("weeklyGroceryBudget").asInt()).isEqualTo(4500);
        assertThat(updated.get("name").asText()).isEqualTo("The Test Family");
        call(patch("/api/v1/family"), lead.token(), Map.of("weeklyGroceryBudget", -1), 422);
        JsonNode noBudget = call(patch("/api/v1/family"), lead.token(), java.util.Collections.singletonMap("weeklyGroceryBudget", null), 200);
        assertThat(noBudget.has("weeklyGroceryBudget")).isFalse();

        JsonNode ayaan = call(post("/api/v1/family/dependants"), lead.token(), Map.of("name", "Ayaan", "relation", "Nephew", "birthYear", 2019, "notes", "Peanut allergy"), 201);
        call(post("/api/v1/family/dependants"), lead.token(), Map.of("name", " ", "relation", ""), 400);
        JsonNode renamed = call(put("/api/v1/family/dependants/" + ayaan.get("id").asText()), lead.token(), Map.of("name", "Ayaan Mannan", "relation", "Nephew", "notes", ""), 200);
        assertThat(renamed.get("name").asText()).isEqualTo("Ayaan Mannan");

        // Not while they have an upcoming appointment (care-service is asked).
        when(services.get(anyString(), any(ParameterizedTypeReference.class)))
                .thenReturn(List.of(Map.of("forId", ayaan.get("id").asText(), "start", Instant.now().plus(1, ChronoUnit.DAYS).toString())));
        JsonNode blocked = call(delete("/api/v1/family/dependants/" + ayaan.get("id").asText()), lead.token(), null, 409);
        assertThat(blocked.get("detail").asText()).contains("upcoming appointments");
        when(services.get(anyString(), any(ParameterizedTypeReference.class))).thenReturn(List.of());
        call(delete("/api/v1/family/dependants/" + ayaan.get("id").asText()), lead.token(), null, 204);
        assertThat(outboxEventTypes()).contains("dependant.added", "dependant.updated", "dependant.removed", "family.updated");
    }

    @Test
    void aPasswordResetLinkSetsANewPasswordAndEndsOtherSessions() throws Exception {
        String address = email("reset");
        Session session = signUp("Reset Test", address);

        call(post("/api/v1/auth/password-reset"), null, Map.of("email", email("unknown")), 204);
        call(post("/api/v1/auth/password-reset"), null, Map.of("email", address), 204);
        String token = tokenFromLatestEmail(address, "Reset your Hearth password");

        call(post("/api/v1/auth/password-reset/confirm"), null, Map.of("token", token, "password", "short"), 422);
        call(post("/api/v1/auth/password-reset/confirm"), null, Map.of("token", token, "password", "NewSunrise#2026"), 204);
        call(post("/api/v1/auth/password-reset/confirm"), null, Map.of("token", token, "password", "Another#2026"), 410);

        call(post("/api/v1/auth/refresh"), null, Map.of("refreshToken", session.refreshToken()), 401);
        call(post("/api/v1/auth/sign-in"), null, Map.of("email", address, "password", PASSWORD), 401);
        JsonNode signedIn = call(post("/api/v1/auth/sign-in"), null, Map.of("email", address, "password", "NewSunrise#2026"), 200);
        assertThat(signedIn.get("session").get("account").get("emailVerified").asBoolean()).isTrue();
    }

    @Test
    void accountChangesShowOnTheMemberCardAndANewEmailMustBeConfirmed() throws Exception {
        Session lead = signUp("Afsara Mannan", email("lead"));
        createFamily(lead, List.of());
        String newEmail = email("new");

        JsonNode account = call(patch("/api/v1/account"), lead.token(), Map.of("name", "Afsara S. Mannan", "phone", "+880 1711 000000", "email", newEmail, "photo", "data:image/png;base64,AAAA"), 200);
        assertThat(account.get("emailVerified").asBoolean()).isFalse();
        call(patch("/api/v1/account"), lead.token(), Map.of("photo", "https://evil.example/x.png"), 422);
        call(patch("/api/v1/account"), lead.token(), Map.of("phone", "abc"), 422);

        JsonNode me = call(get("/api/v1/members"), lead.token(), null, 200).get(0);
        assertThat(me.get("name").asText()).isEqualTo("Afsara S. Mannan");
        assertThat(me.get("email").asText()).isEqualTo(newEmail);
        assertThat(me.get("photo").asText()).startsWith("data:image/png");
        assertThat(tokenFromLatestEmail(newEmail, "Confirm your email")).isNotBlank();
    }
}
