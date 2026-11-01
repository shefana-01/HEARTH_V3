package com.hearth.family.security;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * A sliding-window limiter kept in this instance's memory. Correct for one instance; with several, each
 * counts separately (use {@link RedisRateLimiter}). Also the fallback while Redis is unreachable.
 */
public class InMemoryRateLimiter implements RateLimiter {

    private static final long MAX_WINDOW_MS = Duration.ofHours(1).toMillis();

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    public InMemoryRateLimiter() {
        this(System::currentTimeMillis);
    }

    InMemoryRateLimiter(LongSupplier clock) {
        this.clock = clock;
    }

    @Override
    public boolean tryAcquire(String key, int limit, Duration window) {
        long now = clock.getAsLong();
        Deque<Long> recent = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (recent) {
            while (!recent.isEmpty() && recent.peekFirst() <= now - window.toMillis()) {
                recent.pollFirst();
            }
            if (recent.size() >= limit) {
                return false;
            }
            recent.addLast(now);
            return true;
        }
    }

    /** Forgets keys that have been quiet for an hour, so the map does not grow forever. */
    public void forgetQuiet() {
        long cutoff = clock.getAsLong() - MAX_WINDOW_MS;
        hits.entrySet().removeIf(entry -> {
            synchronized (entry.getValue()) {
                return entry.getValue().isEmpty() || entry.getValue().peekLast() < cutoff;
            }
        });
    }

    int size() {
        return hits.size();
    }
}
