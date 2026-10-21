package com.hearth.family.security;

import com.hearth.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * The same three rules the sign-up form shows (8+ characters, a number or symbol, an uppercase letter),
 * checked again here because the browser can be bypassed. BCrypt only reads the first 72 bytes, so
 * longer passwords are refused rather than silently shortened.
 */
public final class PasswordPolicy {

    private PasswordPolicy() {
    }

    public static void check(String password) {
        if (password == null || password.isEmpty()) {
            throw ApiException.unprocessable("Create a password.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.unprocessable("Passwords can be up to 72 characters.");
        }
        List<String> missing = new ArrayList<>();
        if (password.length() < 8) {
            missing.add("8+ characters");
        }
        if (!password.matches("(?s).*[0-9\\W_].*")) {
            missing.add("1 number or symbol");
        }
        if (!password.matches("(?s).*[A-Z].*")) {
            missing.add("1 uppercase letter");
        }
        if (!missing.isEmpty()) {
            throw ApiException.unprocessable("Password needs " + String.join(", ", missing) + ".");
        }
    }
}
