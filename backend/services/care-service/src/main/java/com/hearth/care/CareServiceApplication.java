package com.hearth.care;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Appointments, health notes and food suggestions, the shopping list, documents and the family map. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class CareServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CareServiceApplication.class, args);
    }
}
