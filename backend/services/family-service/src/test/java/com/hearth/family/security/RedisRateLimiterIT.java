package com.hearth.family.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** The shared limiter against a real Redis: one count across instances, and memory when Redis is gone. */
@Tag("docker")
@Testcontainers
class RedisRateLimiterIT {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static StringRedisTemplate template(String host, int port) {
        LettuceConnectionFactory factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration(host, port),
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofMillis(500)).build());
        factory.afterPropertiesSet();
        StringRedisTemplate template = new StringRedisTemplate(factory);
        template.afterPropertiesSet();
        return template;
    }

    @Test
    void twoInstancesShareOneCountThatExpires() {
        StringRedisTemplate redisTemplate = template(redis.getHost(), redis.getMappedPort(6379));
        RateLimiter first = new RedisRateLimiter(redisTemplate, new InMemoryRateLimiter());
        RateLimiter second = new RedisRateLimiter(redisTemplate, new InMemoryRateLimiter());
        String key = "ip-" + UUID.randomUUID();

        assertThat(first.tryAcquire(key, 3, Duration.ofMinutes(1))).isTrue();
        assertThat(second.tryAcquire(key, 3, Duration.ofMinutes(1))).isTrue();
        assertThat(first.tryAcquire(key, 3, Duration.ofMinutes(1))).isTrue();
        assertThat(second.tryAcquire(key, 3, Duration.ofMinutes(1))).as("the fourth attempt, on another instance").isFalse();

        String stored = redisTemplate.keys(RedisRateLimiter.PREFIX + key + ":*").iterator().next();
        assertThat(redisTemplate.getExpire(stored)).isBetween(1L, 60L);
    }

    @Test
    void withoutRedisTheMemoryLimiterStillProtects() {
        StringRedisTemplate unreachable = template("127.0.0.1", 1);
        RateLimiter limiter = new RedisRateLimiter(unreachable, new InMemoryRateLimiter());
        assertThat(limiter.tryAcquire("x", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.tryAcquire("x", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.tryAcquire("x", 2, Duration.ofMinutes(1))).isFalse();
    }
}
