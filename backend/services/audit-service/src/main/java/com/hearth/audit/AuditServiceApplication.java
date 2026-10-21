package com.hearth.audit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** The family's activity log: an append-only record of what changed, built from every service's events. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class AuditServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuditServiceApplication.class, args);
    }
}
