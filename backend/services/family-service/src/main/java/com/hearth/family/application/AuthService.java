package com.hearth.family.application;

import com.hearth.family.domain.User;
import com.hearth.family.infrastructure.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final TokenService tokenService;

    public String signIn(String email, String password) {
        return "mock-jwt-token";
    }

    public void signOut(String refreshToken) {
        // revoke refresh token
    }
}
