package com.hearth.ai.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings for the AI provider and the fair-use limits ({@code hearth.ai.*}).
 *
 * @param apiKey                  provider key; blank switches AI help off
 * @param baseUrl                 provider address (overridden in tests)
 * @param model                   model name sent with every request
 * @param maxOutputTokens         upper bound for one answer
 * @param timeout                 how long one provider call may take
 * @param dailyRequestsPerMember  requests one person may make per day (in the family's time zone)
 * @param monthlyTokensPerFamily  input plus output tokens one family may use per calendar month
 */
@ConfigurationProperties(prefix = "hearth.ai")
public record AiProperties(
        String apiKey,
        String baseUrl,
        String model,
        int maxOutputTokens,
        Duration timeout,
        int dailyRequestsPerMember,
        long monthlyTokensPerFamily) {

    public AiProperties {
        baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://generativelanguage.googleapis.com/v1beta/openai" : baseUrl.replaceAll("/+$", "");
        model = model == null || model.isBlank() ? "gemini-2.5-flash" : model;
        maxOutputTokens = maxOutputTokens <= 0 ? 1500 : maxOutputTokens;
        timeout = timeout == null ? Duration.ofSeconds(45) : timeout;
        dailyRequestsPerMember = dailyRequestsPerMember <= 0 ? 40 : dailyRequestsPerMember;
        monthlyTokensPerFamily = monthlyTokensPerFamily <= 0 ? 500_000 : monthlyTokensPerFamily;
    }

    public boolean enabled() {
        return apiKey != null && !apiKey.isBlank();
    }
}
