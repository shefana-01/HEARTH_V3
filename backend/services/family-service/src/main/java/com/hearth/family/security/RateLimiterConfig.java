package com.hearth.family.security;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Chooses where sign-in attempts are counted: {@code hearth.rate-limit.store=redis} (several instances share
 * one count) or {@code memory} (one instance). Redis falls back to memory while it is unreachable.
 */
@Configuration
public class RateLimiterConfig {

    private final InMemoryRateLimiter memory = new InMemoryRateLimiter();

    @Bean
    public RateLimiter rateLimiter(@Value("${hearth.rate-limit.store:memory}") String store, ObjectProvider<StringRedisTemplate> redis) {
        StringRedisTemplate template = redis.getIfAvailable();
        if ("redis".equalsIgnoreCase(store) && template != null) {
            return new RedisRateLimiter(template, memory);
        }
        return memory;
    }

    @Scheduled(fixedDelay = 300_000)
    public void forgetQuietAddresses() {
        memory.forgetQuiet();
    }
}
