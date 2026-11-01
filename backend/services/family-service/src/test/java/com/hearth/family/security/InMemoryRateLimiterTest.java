package com.hearth.family.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InMemoryRateLimiterTest {

    @Test
    @DisplayName("allows the limit within a window, refuses the next, and allows again once the window slides")
    void slidingWindow() {
        AtomicLong now = new AtomicLong(1_000_000);
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(now::get);
        for (int i = 0; i < 3; i++) {
            assertThat(limiter.tryAcquire("1.2.3.4", 3, Duration.ofMinutes(1))).isTrue();
            now.addAndGet(1_000);
        }
        assertThat(limiter.tryAcquire("1.2.3.4", 3, Duration.ofMinutes(1))).isFalse();
        assertThat(limiter.tryAcquire("5.6.7.8", 3, Duration.ofMinutes(1))).as("other addresses are counted separately").isTrue();
        now.addAndGet(58_000);
        assertThat(limiter.tryAcquire("1.2.3.4", 3, Duration.ofMinutes(1))).as("the first attempt has left the window").isTrue();
    }

    @Test
    @DisplayName("quiet addresses are forgotten")
    void forgetsQuietAddresses() {
        AtomicLong now = new AtomicLong(0);
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(now::get);
        limiter.tryAcquire("a", 5, Duration.ofMinutes(1));
        now.set(Duration.ofHours(2).toMillis());
        limiter.tryAcquire("b", 5, Duration.ofMinutes(1));
        limiter.forgetQuiet();
        assertThat(limiter.size()).isEqualTo(1);
    }
}
