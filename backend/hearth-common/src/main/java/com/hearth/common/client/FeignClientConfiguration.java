package com.hearth.common.client;

import com.hearth.common.security.CurrentUser;
import com.hearth.common.web.RequestIdFilter;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;

/**
 * HEAR-468: Client configuration & token propagation helper for inter-service communication.
 * Passes Authorization bearer token and X-Request-Id correlation header to downstream microservices.
 */
@Configuration
public class FeignClientConfiguration {

    public void applyHeaders(java.util.function.BiConsumer<String, String> headerConsumer) {
        String token = CurrentUser.bearer();
        if (token != null && !token.isBlank()) {
            headerConsumer.accept(HttpHeaders.AUTHORIZATION, token);
        }
        String requestId = RequestIdFilter.current();
        if (requestId != null) {
            headerConsumer.accept(RequestIdFilter.HEADER, requestId);
        }
    }
}
