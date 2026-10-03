package com.hearth.family.api;

import com.hearth.family.application.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/signin")
    public ResponseEntity<Map<String, String>> signIn(@RequestBody Map<String, String> creds) {
        String token = authService.signIn(creds.get("email"), creds.get("password"));
        return ResponseEntity.ok(Map.of("accessToken", token));
    }

    @PostMapping("/signout")
    public ResponseEntity<Void> signOut(@RequestBody Map<String, String> req) {
        authService.signOut(req.get("refreshToken"));
        return ResponseEntity.noContent().build();
    }
}
