package com.hearth.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WebPushCryptoTest {

    @Test
    @DisplayName("matches the RFC 8291 Appendix A test vector byte for byte")
    void rfc8291TestVector() throws Exception {
        byte[] plaintext = "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8);
        ECPrivateKey asPrivate = WebPushCrypto.decodePrivateKey("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        ECPublicKey asPublic = WebPushCrypto.decodePublicKey(WebPushCrypto.fromB64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"));
        ECPublicKey uaPublic = WebPushCrypto.decodePublicKey(WebPushCrypto.fromB64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"));
        byte[] salt = WebPushCrypto.fromB64("DGv6ra1nlYgDCS1FRnbzlw");
        byte[] auth = WebPushCrypto.fromB64("BTBZMqHH6r4Tts7J_aSIgg");

        byte[] body = WebPushCrypto.encrypt(plaintext, uaPublic, auth, new KeyPair(asPublic, asPrivate), salt);

        assertThat(WebPushCrypto.b64(body)).isEqualTo(
                "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
    }

    @Test
    @DisplayName("the subscriber can decrypt what was sent, and a different subscriber cannot")
    void roundTrip() throws Exception {
        KeyPair browser = WebPushCrypto.generateKeyPair();
        KeyPair stranger = WebPushCrypto.generateKeyPair();
        byte[] auth = new byte[16];
        new java.security.SecureRandom().nextBytes(auth);
        String uaPublic = WebPushCrypto.b64(WebPushCrypto.encodePublicKey((ECPublicKey) browser.getPublic()));
        byte[] message = "{\"title\":\"Hearth\",\"body\":\"রাফিদ কাজটি নিয়েছে\"}".getBytes(StandardCharsets.UTF_8);

        byte[] body = WebPushCrypto.encrypt(message, uaPublic, WebPushCrypto.b64(auth));

        assertThat(WebPushCrypto.decrypt(body, (ECPrivateKey) browser.getPrivate(), (ECPublicKey) browser.getPublic(), auth)).isEqualTo(message);
        assertThatThrownBy(() -> WebPushCrypto.decrypt(body, (ECPrivateKey) stranger.getPrivate(), (ECPublicKey) stranger.getPublic(), auth))
                .isInstanceOf(java.security.GeneralSecurityException.class);
    }

    @Test
    @DisplayName("payloads too big for one push record are refused")
    void tooLarge() throws Exception {
        KeyPair browser = WebPushCrypto.generateKeyPair();
        String uaPublic = WebPushCrypto.b64(WebPushCrypto.encodePublicKey((ECPublicKey) browser.getPublic()));
        assertThatThrownBy(() -> WebPushCrypto.encrypt(new byte[5000], uaPublic, WebPushCrypto.b64(new byte[16])))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("the VAPID token is signed with the server key, scoped to the push service origin and short-lived")
    void vapidToken() throws Exception {
        KeyPair server = WebPushCrypto.generateKeyPair();
        String publicKey = WebPushCrypto.b64(WebPushCrypto.encodePublicKey((ECPublicKey) server.getPublic()));
        Instant now = Instant.parse("2026-11-05T10:00:00Z");

        String header = Vapid.authorization("https://fcm.googleapis.com/fcm/send/abc123", "mailto:admin@hearth.example", publicKey, (ECPrivateKey) server.getPrivate(), now);

        assertThat(header).startsWith("vapid t=").endsWith(", k=" + publicKey);
        String jwt = header.substring("vapid t=".length(), header.indexOf(','));
        String[] parts = jwt.split("\\.");
        JsonNode claims = new ObjectMapper().readTree(WebPushCrypto.fromB64(parts[1]));
        assertThat(claims.get("aud").asText()).isEqualTo("https://fcm.googleapis.com");
        assertThat(claims.get("sub").asText()).isEqualTo("mailto:admin@hearth.example");
        assertThat(claims.get("exp").asLong()).isEqualTo(now.plus(Vapid.LIFETIME).getEpochSecond());
        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(server.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(WebPushCrypto.fromB64(parts[2]))).isTrue();
    }
}
