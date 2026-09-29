package com.hearth.family.api;

import com.hearth.family.application.JwksService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class JwksController {
    private final JwksService jwksService;

    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> getJwks() {
        return jwksService.getPublicJwks();
    }
}
