package com.hearth.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Settings every service shares: scheduling (outbox relay, reminders), time limits on calls to other
 * services, and the OpenAPI description behind each service's {@code /swagger-ui.html}.
 */
@Configuration
@EnableScheduling
public class CommonConfig {

    /** A slow or stuck service must not hold the caller's request (and a thread) for long. */
    @Bean
    public RestClientCustomizer serviceCallTimeouts() {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.defaults()
                .withConnectTimeout(Duration.ofSeconds(3))
                .withReadTimeout(Duration.ofSeconds(10));
        return builder -> builder.requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings));
    }

    @Bean
    public OpenAPI hearthOpenApi(@Value("${spring.application.name}") String service) {
        return new OpenAPI()
                .info(new Info().title("Hearth " + service).version("v1").description("Part of the Hearth API. Paths are served to the browser under the gateway's /api/v1."))
                .components(new Components().addSecuritySchemes("bearer", new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
