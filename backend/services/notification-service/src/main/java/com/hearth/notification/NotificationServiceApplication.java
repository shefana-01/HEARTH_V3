package com.hearth.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** In-app notifications and the family chat, built from the events the other services publish. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class NotificationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
