package com.hearth.family.application;

import com.hearth.family.domain.SigningKey;
import com.hearth.family.infrastructure.repository.SigningKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class JwksService {
    private final SigningKeyRepository signingKeyRepository;

    public Map<String, Object> getPublicJwks() {
        Optional<SigningKey> keyOpt = signingKeyRepository.findFirstByActiveTrueOrderByCreatedAtDesc();
        Map<String, Object> jwks = new HashMap<>();
        List<Map<String, Object>> keys = new ArrayList<>();
        keyOpt.ifPresent(k -> {
            Map<String, Object> jwk = new HashMap<>();
            jwk.put("kty", "RSA");
            jwk.put("use", "sig");
            jwk.put("alg", "RS256");
            jwk.put("kid", k.getKeyId());
            jwk.put("n", k.getPublicKey());
            jwk.put("e", "AQAB");
            keys.add(jwk);
        });
        jwks.put("keys", keys);
        return jwks;
    }
}
