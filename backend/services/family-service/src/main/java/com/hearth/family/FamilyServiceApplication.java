package com.hearth.family;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Accounts and sign-in, families, members, invitations. Also the identity provider: it issues the JWTs. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class FamilyServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(FamilyServiceApplication.class, args);
    }
}
