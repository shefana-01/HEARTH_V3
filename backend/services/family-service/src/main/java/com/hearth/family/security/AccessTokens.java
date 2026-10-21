package com.hearth.family.security;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

/**
 * Short-lived access tokens: an RS256-signed JWT whose subject is the account id. Every service checks the
 * signature with family-service's public key. Who the person is in a family is looked up on each request
 * (not put in the token), so a removed member loses access immediately.
 */
@Component
public class AccessTokens {

    private final JwtEncoder encoder;
    private final String issuer;
    private final Duration lifetime;

    public AccessTokens(JwtEncoder encoder, @Value("${hearth.security.issuer:hearth}") String issuer, @Value("${hearth.auth.access-token-minutes:15}") long minutes) {
        this.encoder = encoder;
        this.issuer = issuer;
        this.lifetime = Duration.ofMinutes(minutes);
    }

    public String issue(UUID accountId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(accountId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(lifetime))
                .id(UUID.randomUUID().toString())
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
