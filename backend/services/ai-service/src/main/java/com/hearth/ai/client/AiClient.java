package com.hearth.ai.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hearth.ai.config.AiProperties;
import com.hearth.common.error.ApiException;
import java.net.http.HttpClient;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Calls the configured chat-completions AI endpoint (defaults to Google's free-tier compatible endpoint).
 * Structured answers are requested by forcing a single function tool call so the reply matches the declared
 * JSON schema; plain text is used only for message drafts.
 *
 * <p>Provider failures never reach the user as raw errors: they become a 503 with a short message, and the
 * app falls back to its normal forms.
 */
@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);
    private static final int ATTEMPTS = 2;

    private final AiProperties properties;
    private final ObjectMapper mapper;
    private final RestClient rest;

    public AiClient(AiProperties properties, ObjectMapper mapper, RestClient.Builder builder) {
        this.properties = properties;
        this.mapper = mapper;
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(properties.timeout());
        this.rest = builder.clone().requestFactory(factory).baseUrl(properties.baseUrl()).build();
    }

    /** What the model returned and what it cost. */
    public record Reply(JsonNode toolInput, String text, int inputTokens, int outputTokens) {
    }

    /**
     * Asks for an answer in the shape of {@code inputSchema} (a JSON schema object).
     *
     * @param system      instructions; the person's own words always go in {@code user}, never here
     * @param user        the request, with any person-written text clearly marked as data
     * @param toolName    name of the single tool the model must call
     * @param description what the tool is for
     */
    public Reply structured(String system, String user, String toolName, String description, ObjectNode inputSchema) {
        ObjectNode body = baseRequest(system, user);
        ArrayNode tools = body.putArray("tools");
        ObjectNode tool = tools.addObject();
        tool.put("type", "function");
        ObjectNode function = tool.putObject("function");
        function.put("name", toolName);
        function.put("description", description);
        function.set("parameters", inputSchema);

        ObjectNode choice = body.putObject("tool_choice");
        choice.put("type", "function");
        choice.putObject("function").put("name", toolName);

        JsonNode response = send(body);
        for (JsonNode item : response.path("choices")) {
            for (JsonNode call : item.path("message").path("tool_calls")) {
                JsonNode fn = call.path("function");
                if (toolName.equals(fn.path("name").asText())) {
                    JsonNode arguments = parseArguments(fn.path("arguments"));
                    return new Reply(arguments, null, tokens(response, "prompt_tokens"), tokens(response, "completion_tokens"));
                }
            }
        }
        log.warn("AI reply had no {} tool call", toolName);
        throw unavailable();
    }

    /** Asks for plain text (message drafts). */
    public Reply text(String system, String user) {
        JsonNode response = send(baseRequest(system, user));
        StringBuilder text = new StringBuilder();
        for (JsonNode item : response.path("choices")) {
            String content = item.path("message").path("content").asText("");
            if (!content.isBlank()) {
                text.append(content);
            }
        }
        if (text.isEmpty()) {
            throw unavailable();
        }
        return new Reply(null, text.toString().strip(), tokens(response, "prompt_tokens"), tokens(response, "completion_tokens"));
    }

    private ObjectNode baseRequest(String system, String user) {
        if (!properties.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI help is switched off on this Hearth. You can still add and plan everything yourself.");
        }
        ObjectNode body = mapper.createObjectNode();
        body.put("model", properties.model());
        body.put("max_tokens", properties.maxOutputTokens());
        ArrayNode messages = body.putArray("messages");
        ObjectNode sys = messages.addObject();
        sys.put("role", "system");
        sys.put("content", system);
        ObjectNode usr = messages.addObject();
        usr.put("role", "user");
        usr.put("content", user);
        return body;
    }

    private JsonNode parseArguments(JsonNode raw) {
        if (raw == null || raw.isMissingNode() || raw.isNull()) {
            throw unavailable();
        }
        if (raw.isObject()) {
            return raw;
        }
        try {
            return mapper.readTree(raw.asText());
        } catch (JsonProcessingException ex) {
            log.warn("AI tool call arguments were not valid JSON");
            throw unavailable();
        }
    }

    private JsonNode send(ObjectNode body) {
        for (int attempt = 1; ; attempt++) {
            try {
                JsonNode response = rest.post()
                        .uri("/chat/completions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(JsonNode.class);
                if (response == null) {
                    throw unavailable();
                }
                return response;
            } catch (RestClientResponseException ex) {
                int status = ex.getStatusCode().value();
                boolean retryable = status == 429 || status == 529 || status >= 500;
                if (retryable && attempt < ATTEMPTS) {
                    pause(attempt);
                    continue;
                }
                if (status == 401 || status == 403) {
                    log.error("The AI provider refused the API key ({}). Check AI_API_KEY.", status);
                } else {
                    log.warn("AI provider answered {}: {}", status, abbreviate(ex.getResponseBodyAsString()));
                }
                throw status == 429 || status == 529
                        ? new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI help is busy right now. Please try again in a minute.")
                        : unavailable();
            } catch (ResourceAccessException ex) {
                if (attempt < ATTEMPTS) {
                    pause(attempt);
                    continue;
                }
                log.warn("Could not reach the AI provider: {}", ex.getMessage());
                throw unavailable();
            }
        }
    }

    private static int tokens(JsonNode response, String field) {
        return Math.max(0, response.path("usage").path(field).asInt(0));
    }

    private static void pause(int attempt) {
        try {
            Thread.sleep(400L * attempt);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private static String abbreviate(String text) {
        return text == null ? "" : text.length() > 300 ? text.substring(0, 300) + "…" : text;
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI help could not answer just now. Please try again, or carry on without it.");
    }
}
