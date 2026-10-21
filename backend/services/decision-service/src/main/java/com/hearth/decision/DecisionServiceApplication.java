package com.hearth.decision;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** The decision engine, handover requests and the family's week view. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class DecisionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(DecisionServiceApplication.class, args);
    }
}
