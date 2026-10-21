package com.hearth.family.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Limits how often one address may call the public sign-in endpoints (default 20 a minute), so passwords
 * cannot be guessed at speed and nobody can flood people with reset emails. Per instance and in memory,
 * which is enough for one server; with several instances a shared store (Redis) would take its place.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED = Set.of("/api/v1/auth/sign-in", "/api/v1/auth/sign-up", "/api/v1/auth/password-reset", "/api/v1/auth/password-reset/confirm", "/api/v1/auth/verify-email");
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    private final ObjectMapper mapper;
    private final int limit;

    public AuthRateLimitFilter(ObjectMapper mapper, @Value("${hearth.auth.requests-per-minute:20}") int limit) {
        this.mapper = mapper;
        this.limit = limit;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !LIMITED.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        Deque<Long> recent = hits.computeIfAbsent(clientAddress(request), key -> new ArrayDeque<>());
        boolean allowed;
        synchronized (recent) {
            while (!recent.isEmpty() && recent.peekFirst() < now - WINDOW.toMillis()) {
                recent.pollFirst();
            }
            allowed = recent.size() < limit;
            if (allowed) {
                recent.addLast(now);
            }
        }
        if (!allowed) {
            ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Please wait a minute and try again.");
            body.setTitle(HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase());
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            mapper.writeValue(response.getOutputStream(), body);
            return;
        }
        chain.doFilter(request, response);
    }

    /** Forget addresses that have been quiet for a while. */
    @Scheduled(fixedDelay = 300_000)
    public void forgetQuietAddresses() {
        long cutoff = System.currentTimeMillis() - WINDOW.toMillis();
        hits.entrySet().removeIf(entry -> {
            synchronized (entry.getValue()) {
                return entry.getValue().isEmpty() || entry.getValue().peekLast() < cutoff;
            }
        });
    }

    /** Behind the gateway the browser's address is the first entry of X-Forwarded-For. */
    private static String clientAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
