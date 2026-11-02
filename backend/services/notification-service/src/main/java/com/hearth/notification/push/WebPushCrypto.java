package com.hearth.notification.push;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Web Push message encryption (RFC 8291, "aes128gcm" content coding from RFC 8188) and the P-256 key
 * handling it needs, with the JDK's own cryptography only. Verified against the RFC 8291 test vector.
 *
 * <p>Only the browser that subscribed can read a message: the payload is encrypted with a key agreed
 * between a fresh server key pair and the subscription's public key, mixed with its auth secret.
 */
public final class WebPushCrypto {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Decoder B64 = Base64.getUrlDecoder();
    private static final Base64.Encoder B64_OUT = Base64.getUrlEncoder().withoutPadding();
    /** One record is enough for a notification: 4096 bytes is what push services accept. */
    static final int RECORD_SIZE = 4096;
    private static final ECParameterSpec P256 = p256();

    private WebPushCrypto() {
    }

    /** Encrypts {@code plaintext} for one subscription with a new server key and salt. */
    public static byte[] encrypt(byte[] plaintext, String uaPublicB64, String authSecretB64) throws GeneralSecurityException {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, decodePublicKey(B64.decode(uaPublicB64)), B64.decode(authSecretB64), generateKeyPair(), salt);
    }

    /** Encryption with a given server key pair and salt (for the RFC test vector). */
    static byte[] encrypt(byte[] plaintext, ECPublicKey uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt) throws GeneralSecurityException {
        if (plaintext.length > RECORD_SIZE - 17 - 86) {
            throw new IllegalArgumentException("Push payload too large: " + plaintext.length + " bytes");
        }
        byte[] uaRaw = encodePublicKey(uaPublic);
        byte[] asRaw = encodePublicKey((ECPublicKey) asKeys.getPublic());

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(asKeys.getPrivate());
        agreement.doPhase(uaPublic, true);
        byte[] ecdhSecret = agreement.generateSecret();

        // RFC 8291 section 3.3: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaRaw, asRaw);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
        // RFC 8188 section 2.2 / 2.3
        byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        // A single record: the plaintext followed by the 0x02 "last record" delimiter.
        byte[] padded = Arrays.copyOf(plaintext, plaintext.length + 1);
        padded[plaintext.length] = 2;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(padded);

        // Header: salt(16) | record size(4) | key id length(1) | key id (the server public key, 65)
        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asRaw.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asRaw.length).put(asRaw);
        return concat(header.array(), ciphertext);
    }

    /** The receiving side, used by tests to prove a browser can read what was sent. */
    static byte[] decrypt(byte[] body, ECPrivateKey uaPrivate, ECPublicKey uaPublic, byte[] authSecret) throws GeneralSecurityException {
        ByteBuffer in = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        in.get(salt);
        in.getInt();
        byte[] asRaw = new byte[in.get() & 0xff];
        in.get(asRaw);
        byte[] ciphertext = new byte[in.remaining()];
        in.get(ciphertext);

        ECPublicKey asPublic = decodePublicKey(asRaw);
        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(uaPrivate);
        agreement.doPhase(asPublic, true);
        byte[] ecdhSecret = agreement.generateSecret();
        byte[] ikm = hkdf(authSecret, ecdhSecret, concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), encodePublicKey(uaPublic), asRaw), 32);
        byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = cipher.doFinal(ciphertext);
        int end = padded.length - 1;
        while (end >= 0 && padded[end] == 0) {
            end--;
        }
        if (end < 0 || padded[end] != 2) {
            throw new GeneralSecurityException("Bad record delimiter");
        }
        return Arrays.copyOf(padded, end);
    }

    /* ───────── keys ───────── */

    public static KeyPair generateKeyPair() throws GeneralSecurityException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        return generator.generateKeyPair();
    }

    /** 65-byte uncompressed point (0x04 | X | Y), as browsers and VAPID use it. */
    public static byte[] encodePublicKey(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        System.arraycopy(unsigned(key.getW().getAffineX(), 32), 0, out, 1, 32);
        System.arraycopy(unsigned(key.getW().getAffineY(), 32), 0, out, 33, 32);
        return out;
    }

    public static ECPublicKey decodePublicKey(byte[] raw) throws GeneralSecurityException {
        if (raw.length != 65 || raw[0] != 4) {
            throw new GeneralSecurityException("Not an uncompressed P-256 public key");
        }
        ECPoint point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33)), new BigInteger(1, Arrays.copyOfRange(raw, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, P256));
    }

    /** A private key from its 32-byte scalar (base64url), as VAPID keys are usually written down. */
    public static ECPrivateKey decodePrivateKey(String b64) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, B64.decode(b64)), P256));
    }

    public static String b64(byte[] bytes) {
        return B64_OUT.encodeToString(bytes);
    }

    public static byte[] fromB64(String text) {
        return B64.decode(text);
    }

    /* ───────── helpers ───────── */

    /** HKDF-SHA-256 (RFC 5869) for outputs up to one hash length. */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    private static byte[] unsigned(BigInteger value, int length) {
        byte[] bytes = value.toByteArray();
        if (bytes.length == length) {
            return bytes;
        }
        byte[] out = new byte[length];
        int copy = Math.min(bytes.length, length);
        System.arraycopy(bytes, bytes.length - copy, out, length - copy, copy);
        return out;
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            return parameters.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("P-256 is not available", ex);
        }
    }
}
