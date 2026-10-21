package com.hearth.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Every service is a stateless OAuth2 resource server: each request must carry a valid JWT, signed by
 * family-service (checked against its public keys at {@code hearth.security.jwks-uri}) and issued by
 * {@code hearth.security.issuer}.
 *
 * A service lists the few paths that need no token in {@code hearth.security.public-paths}.
 * Failures are answered as RFC 7807 problem documents, like every other error.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper, @Value("${hearth.security.public-paths:}") String[] publicPaths) throws Exception {
        http.csrf(csrf -> csrf.disable());
        http.cors(cors -> cors.disable()); // The gateway answers CORS for the browser.
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        http.authorizeHttpRequests(auth -> {
            auth.requestMatchers("/actuator/health/**", "/actuator/info", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error").permitAll();
            if (publicPaths.length > 0) {
                auth.requestMatchers(publicPaths).permitAll();
            }
            auth.anyRequest().authenticated();
        });
        http.oauth2ResourceServer(oauth -> oauth
                .jwt(jwt -> {
                })
                .authenticationEntryPoint((request, response, ex) -> write(response, mapper, HttpStatus.UNAUTHORIZED, "Your session has ended. Sign in again."))
                .accessDeniedHandler((request, response, ex) -> write(response, mapper, HttpStatus.FORBIDDEN, "You don’t have permission to do that.")));
        http.exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> write(response, mapper, HttpStatus.UNAUTHORIZED, "Sign in first."))
                .accessDeniedHandler((request, response, e) -> write(response, mapper, HttpStatus.FORBIDDEN, "You don’t have permission to do that.")));
        return http.build();
    }

    /**
     * Checks the signature against family-service's published keys, the expiry and the issuer.
     * family-service sets no {@code jwks-uri} and declares its own decoder: it holds the key, so it does
     * not fetch it over HTTP.
     */
    @Bean
    @ConditionalOnProperty(name = "hearth.security.jwks-uri")
    public JwtDecoder jwtDecoder(@Value("${hearth.security.jwks-uri}") String jwksUri, @Value("${hearth.security.issuer:hearth}") String issuer) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer)));
        return decoder;
    }

    private static void write(HttpServletResponse response, ObjectMapper mapper, HttpStatus status, String detail) throws IOException {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setTitle(status.getReasonPhrase());
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), body);
    }
}
