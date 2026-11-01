package com.hearth.family.security;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * A fixed-window limiter in Redis, shared by every instance of family-service. The count and its expiry
 * are set in one Lua script, so they are atomic. If Redis cannot be reached the in-memory limiter takes over
 * (still protected, just per instance) instead of letting every request through or refusing them all.
 */
public class RedisRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimiter.class);
    static final String PREFIX = "hearth:rate:";
    private static final RedisScript<Long> INCREMENT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """, Long.class);

    private final StringRedisTemplate redis;
    private final InMemoryRateLimiter fallback;
    private final AtomicLong lastWarning = new AtomicLong();

    public RedisRateLimiter(StringRedisTemplate redis, InMemoryRateLimiter fallback) {
        this.redis = redis;
        this.fallback = fallback;
    }

    @Override
    public boolean tryAcquire(String key, int limit, Duration window) {
        long bucket = System.currentTimeMillis() / window.toMillis();
        try {
            Long count = redis.execute(INCREMENT, List.of(PREFIX + key + ":" + bucket), String.valueOf(window.toMillis()));
            return count != null && count <= limit;
        } catch (RuntimeException ex) {
            long now = System.currentTimeMillis();
            long last = lastWarning.get();
            if (now - last > 60_000 && lastWarning.compareAndSet(last, now)) {
                log.warn("Redis is unreachable; limiting sign-in attempts in memory until it is back ({})", ex.getMessage());
            }
            return fallback.tryAcquire(key, limit, window);
        }
    }
}
