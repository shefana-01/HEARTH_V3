package com.hearth.notification.push;

import com.hearth.common.family.FamilyDirectory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Push notifications on the caller's devices. The subscription object is the one the browser's PushManager returns. */
@RestController
@RequestMapping("/api/v1/notifications/push")
public class PushController {

    private final FamilyDirectory directory;
    private final PushService push;

    public PushController(FamilyDirectory directory, PushService push) {
        this.directory = directory;
        this.push = push;
    }

    public record Keys(@NotBlank @Size(max = 200) String p256dh, @NotBlank @Size(max = 100) String auth) {
    }

    public record SubscriptionRequest(@NotBlank @Size(max = 1000) String endpoint, @NotNull @Valid Keys keys) {
    }

    public record PushStatus(boolean enabled, String publicKey, int devices) {
    }

    @GetMapping
    public PushStatus status() {
        PushService.PushConfig config = push.config();
        return new PushStatus(config.enabled(), config.publicKey(), push.deviceCount(directory.context()));
    }

    @PostMapping("/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@Valid @RequestBody SubscriptionRequest request, @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        push.subscribe(directory.context(), request.endpoint(), request.keys().p256dh(), request.keys().auth(), userAgent);
    }

    @DeleteMapping("/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@RequestParam String endpoint) {
        push.unsubscribe(directory.context(), endpoint);
    }
}
