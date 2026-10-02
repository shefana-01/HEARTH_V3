package com.hearth.common.security;

import com.hearth.common.error.ApiException;
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

    /** The caller's subject, or null when the request carries no token (public endpoints). */
    public static String subjectOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication instanceof JwtAuthenticationToken token ? token.getToken().getSubject() : null;
    }

    /** The identity provider's id for this user (the JWT "sub" claim). */
    public static String subject() {
        return jwt().getSubject();
    }

    /** {@code Authorization} header value used to call another service as the same user. */
    public static String bearer() {
        return "Bearer " + jwt().getTokenValue();
    }
}
