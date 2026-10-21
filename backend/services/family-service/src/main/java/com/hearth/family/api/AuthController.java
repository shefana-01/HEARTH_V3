package com.hearth.family.api;

import com.hearth.common.security.CurrentUser;
import com.hearth.family.application.AuthService;
import com.hearth.family.dto.FamilyDtos.AuthResponse;
import com.hearth.family.dto.FamilyDtos.EmailRequest;
import com.hearth.family.dto.FamilyDtos.NewPasswordRequest;
import com.hearth.family.dto.FamilyDtos.RefreshRequest;
import com.hearth.family.dto.FamilyDtos.SessionView;
import com.hearth.family.dto.FamilyDtos.SignInRequest;
import com.hearth.family.dto.FamilyDtos.SignUpRequest;
import com.hearth.family.dto.FamilyDtos.TokenPair;
import com.hearth.family.dto.FamilyDtos.TokenRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Sign-up, sign-in, session renewal and the links we email. Everything here except session and resend works without a token. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/sign-up")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signUp(@Valid @RequestBody SignUpRequest request) {
        return auth.signUp(request);
    }

    @PostMapping("/sign-in")
    public AuthResponse signIn(@Valid @RequestBody SignInRequest request) {
        return auth.signIn(request.email(), request.password());
    }

    @PostMapping("/refresh")
    public TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
        return auth.refresh(request.refreshToken());
    }

    @GetMapping("/session")
    public SessionView session() {
        return auth.session(CurrentUser.accountId());
    }

    @PostMapping("/sign-out")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void signOut(@Valid @RequestBody RefreshRequest request) {
        auth.signOut(request.refreshToken());
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody TokenRequest request) {
        auth.verifyEmail(request.token());
    }

    @PostMapping("/verify-email/resend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification() {
        auth.resendVerification(CurrentUser.accountId());
    }

    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestPasswordReset(@Valid @RequestBody EmailRequest request) {
        auth.requestPasswordReset(request.email());
    }

    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmPasswordReset(@Valid @RequestBody NewPasswordRequest request) {
        auth.confirmPasswordReset(request.token(), request.password());
    }
}
