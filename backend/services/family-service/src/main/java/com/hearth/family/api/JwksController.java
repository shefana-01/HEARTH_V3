package com.hearth.family.api;

import com.hearth.family.security.SigningKeys;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public key other services use to check that a token was signed by family-service. */
@RestController
public class JwksController {

    private final SigningKeys keys;

    public JwksController(SigningKeys keys) {
        this.keys = keys;
    }

    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5))).body(keys.publicJwks());
    }
}
