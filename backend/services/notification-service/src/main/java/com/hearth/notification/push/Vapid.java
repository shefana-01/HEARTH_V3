package com.hearth.notification.push;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.time.Duration;
import java.time.Instant;

/**
 * VAPID (RFC 8292): proves to a push service that messages come from the server whose public key the
 * browser subscribed with. One short-lived ES256 token per push service origin.
 */
public final class Vapid {

    static final Duration LIFETIME = Duration.ofHours(12);

    private Vapid() {
    }

    /** The {@code Authorization} header value: {@code vapid t=<jwt>, k=<public key>}. */
    public static String authorization(String endpoint, String subject, String publicKeyB64, ECPrivateKey privateKey, Instant now) throws GeneralSecurityException {
        URI uri = URI.create(endpoint);
        String audience = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
        String header = WebPushCrypto.b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = WebPushCrypto.b64(("{\"aud\":\"" + audience + "\",\"exp\":" + now.plus(LIFETIME).getEpochSecond() + ",\"sub\":\"" + subject.replace("\"", "") + "\"}")
                .getBytes(StandardCharsets.UTF_8));
        Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
        signer.initSign(privateKey);
        signer.update((header + "." + claims).getBytes(StandardCharsets.US_ASCII));
        String jwt = header + "." + claims + "." + WebPushCrypto.b64(signer.sign());
        return "vapid t=" + jwt + ", k=" + publicKeyB64;
    }
}
