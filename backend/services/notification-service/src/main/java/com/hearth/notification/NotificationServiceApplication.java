package com.hearth.notification;

import com.hearth.notification.push.PushProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** In-app notifications and the family chat, built from the events the other services publish. */
@SpringBootApplication(scanBasePackages = "com.hearth")
@EnableConfigurationProperties(PushProperties.class)
public class NotificationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
