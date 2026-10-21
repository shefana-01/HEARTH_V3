package com.hearth.common.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.security.CurrentUser;
import com.hearth.common.web.RequestIdFilter;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Calls another Hearth service on behalf of the signed-in user ("token relay"): the user's JWT is
 * forwarded, so the other service applies the same access rules it would apply to the browser.
 * Errors keep their status and the message written for the user; an unreachable service becomes 503.
 */
@Component
public class ServiceClient {

    private static final Logger log = LoggerFactory.getLogger(ServiceClient.class);

    private final RestClient rest;
    private final ObjectMapper mapper;

    public ServiceClient(RestClient.Builder builder, ObjectMapper mapper) {
        this.rest = builder.build();
        this.mapper = mapper;
    }

    public <T> T get(String url, Class<T> type) {
        return call(url, () -> request(HttpMethod.GET, url).retrieve().body(type));
    }

    public <T> T get(String url, ParameterizedTypeReference<T> type) {
        return call(url, () -> request(HttpMethod.GET, url).retrieve().body(type));
    }

    public <T> T post(String url, Object body, Class<T> type) {
        return call(url, () -> withBody(request(HttpMethod.POST, url), body).retrieve().body(type));
    }

    public <T> T put(String url, Object body, Class<T> type) {
        return call(url, () -> withBody(request(HttpMethod.PUT, url), body).retrieve().body(type));
    }

    public void delete(String url) {
        call(url, () -> request(HttpMethod.DELETE, url).retrieve().toBodilessEntity());
    }

    private RestClient.RequestBodySpec request(HttpMethod method, String url) {
        RestClient.RequestBodySpec spec = rest.method(method).uri(url).header(HttpHeaders.AUTHORIZATION, CurrentUser.bearer()).accept(MediaType.APPLICATION_JSON);
        String requestId = RequestIdFilter.current();
        if (requestId != null) {
            spec.header(RequestIdFilter.HEADER, requestId);
        }
        return spec;
    }

    private static RestClient.RequestBodySpec withBody(RestClient.RequestBodySpec spec, Object body) {
        return body == null ? spec : spec.contentType(MediaType.APPLICATION_JSON).body(body);
    }

    private <T> T call(String url, Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            throw new ApiException(status == null ? HttpStatus.BAD_GATEWAY : status, detailOf(ex));
        } catch (ResourceAccessException ex) {
            log.warn("Could not reach {}: {}", url, ex.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Part of Hearth is not reachable right now. Please try again in a moment.");
        }
    }

    /** Reads the "detail" field of the other service's problem document, if there is one. */
    private String detailOf(RestClientResponseException ex) {
        try {
            JsonNode body = mapper.readTree(ex.getResponseBodyAsString());
            if (body != null && body.has("detail") && !body.get("detail").isNull()) {
                return body.get("detail").asText();
            }
        } catch (Exception ignored) {
            // not a JSON body
        }
        return ex.getStatusCode().value() == 401 ? "Sign in first." : "The request could not be completed.";
    }
}
