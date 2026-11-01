package com.hearth.family.security;

import java.time.Duration;

/** Counts attempts per key (an IP address) in a time window. */
public interface RateLimiter {

    /** Records an attempt and says whether it is within {@code limit} for the current {@code window}. */
    boolean tryAcquire(String key, int limit, Duration window);
}
