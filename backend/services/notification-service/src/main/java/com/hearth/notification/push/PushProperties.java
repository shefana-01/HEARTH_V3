package com.hearth.notification.push;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Web Push settings ({@code hearth.push.*}). Generate the key pair once with {@code node tools/vapid-keys.mjs}.
 *
 * @param publicKey     VAPID public key (65-byte point, base64url); browsers subscribe with it
 * @param privateKey    VAPID private key (32-byte scalar, base64url); keep it secret
 * @param subject       contact for push services, {@code mailto:} or {@code https:}
 * @param allowedHosts  push services Hearth will deliver to (suffix match). Stops a subscription from
 *                      pointing the server at an internal address.
 * @param requireHttps  only https endpoints (always true outside tests)
 */
@ConfigurationProperties(prefix = "hearth.push")
public record PushProperties(String publicKey, String privateKey, String subject, List<String> allowedHosts, boolean requireHttps) {

    public PushProperties {
        subject = subject == null || subject.isBlank() ? "mailto:admin@hearth.local" : subject;
        allowedHosts = allowedHosts == null || allowedHosts.isEmpty()
                ? List.of("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com")
                : List.copyOf(allowedHosts);
    }

    public boolean enabled() {
        return publicKey != null && !publicKey.isBlank() && privateKey != null && !privateKey.isBlank();
    }
}
