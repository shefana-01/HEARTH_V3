package com.hearth.family.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** The RSA key pair that signs access tokens (keys are Base64 PKCS#8 / X.509 DER). */
@Entity
@Table(name = "signing_key")
public class SigningKey {

    @Id
    private String kid;

    @Column(name = "private_key", nullable = false)
    private String privateKey;

    @Column(name = "public_key", nullable = false)
    private String publicKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SigningKey() {
    }

    public SigningKey(String kid, String privateKey, String publicKey) {
        this.kid = kid;
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.createdAt = Instant.now();
    }

    public String getKid() {
        return kid;
    }

    public String getPrivateKey() {
        return privateKey;
    }

    public String getPublicKey() {
        return publicKey;
    }
}
