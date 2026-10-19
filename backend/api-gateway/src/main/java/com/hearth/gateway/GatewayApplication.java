package com.hearth.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The one address the browser talks to. It routes {@code /api/v1/...} to the service that owns it (see
 * application.yml), answers CORS, and gives every request an id that follows it through all the logs.
 * It does not check tokens itself: every service does, so nothing depends on traffic going through here.
 */
@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
