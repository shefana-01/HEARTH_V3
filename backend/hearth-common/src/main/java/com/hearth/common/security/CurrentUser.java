package com.hearth.common.security;

import com.hearth.common.error.ApiException;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** The signed-in caller, read from the validated JWT of the current request. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Jwt jwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            return token.getToken();
        }
        throw ApiException.unauthorized("Sign in first.");
    }

    /** True when the current request carries a validated token. */
    public static boolean isSignedIn() {
        return SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken;
    }

    /** The account id (the JWT "sub" claim, issued by family-service). */
    public static UUID accountId() {
        try {
            return UUID.fromString(jwt().getSubject());
        } catch (IllegalArgumentException ex) {
            throw ApiException.unauthorized("Sign in first.");
        }
    }

    /** {@code Authorization} header value used to call another service as the same user. */
    public static String bearer() {
        return "Bearer " + jwt().getTokenValue();
    }
}
