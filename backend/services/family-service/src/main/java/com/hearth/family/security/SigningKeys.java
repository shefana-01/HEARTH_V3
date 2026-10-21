package com.hearth.family.security;

import com.hearth.family.domain.SigningKey;
import com.hearth.family.repository.SigningKeyRepository;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/**
 * The RSA key pair that signs access tokens. Created on the first start and kept in the database, so
 * tokens stay valid when the service restarts and every instance signs with the same key. Only the
 * public half ever leaves the service ({@link #publicJwks()}).
 */
@Component
public class SigningKeys {

    private static final Logger log = LoggerFactory.getLogger(SigningKeys.class);

    private final RSAKey key;

    public SigningKeys(SigningKeyRepository repository) {
        this.key = repository.findFirstByOrderByCreatedAtDesc().map(SigningKeys::toRsaKey).orElseGet(() -> create(repository));
    }

    /** The full key (private and public), for signing. */
    public RSAKey signingKey() {
        return key;
    }

    public RSAPublicKey publicKey() {
        try {
            return key.toRSAPublicKey();
        } catch (Exception ex) {
            throw new IllegalStateException("Signing key is not usable", ex);
        }
    }

    /** The JSON Web Key Set other services use to check signatures. Public key only. */
    public Map<String, Object> publicJwks() {
        return new JWKSet(key.toPublicJWK()).toJSONObject(true);
    }

    private static RSAKey create(SigningKeyRepository repository) {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            String kid = UUID.randomUUID().toString();
            Base64.Encoder base64 = Base64.getEncoder();
            SigningKey stored = new SigningKey(kid, base64.encodeToString(pair.getPrivate().getEncoded()), base64.encodeToString(pair.getPublic().getEncoded()));
            repository.saveAndFlush(stored);
            log.info("Created a new token signing key {}", kid);
            return toRsaKey(stored);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("RSA is not available", ex);
        } catch (DataIntegrityViolationException ex) {
            // Another instance created one at the same moment: use that.
            return repository.findFirstByOrderByCreatedAtDesc().map(SigningKeys::toRsaKey).orElseThrow(() -> ex);
        }
    }

    private static RSAKey toRsaKey(SigningKey stored) {
        try {
            KeyFactory factory = KeyFactory.getInstance("RSA");
            Base64.Decoder base64 = Base64.getDecoder();
            RSAPrivateKey privateKey = (RSAPrivateKey) factory.generatePrivate(new PKCS8EncodedKeySpec(base64.decode(stored.getPrivateKey())));
            RSAPublicKey publicKey = (RSAPublicKey) factory.generatePublic(new X509EncodedKeySpec(base64.decode(stored.getPublicKey())));
            return new RSAKey.Builder(publicKey).privateKey(privateKey).keyID(stored.getKid()).keyUse(KeyUse.SIGNATURE).algorithm(JWSAlgorithm.RS256).build();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new IllegalStateException("The stored signing key could not be read", ex);
        }
    }
}
