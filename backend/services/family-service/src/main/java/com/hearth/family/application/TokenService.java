package com.hearth.family.application;

import com.hearth.family.domain.RefreshToken;
import com.hearth.family.infrastructure.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TokenService {
    private final RefreshTokenRepository refreshTokenRepository;

    public String generateRefreshToken(UUID userId) {
        String rawToken = UUID.randomUUID().toString();
        String hash = hashToken(rawToken);
        RefreshToken token = RefreshToken.builder()
                .tokenHash(hash)
                .userId(userId)
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(token);
        return rawToken;
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(encoded);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
