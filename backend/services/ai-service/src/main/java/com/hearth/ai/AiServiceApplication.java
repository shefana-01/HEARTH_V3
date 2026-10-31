package com.hearth.ai;

import com.hearth.ai.config.AiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * AI help for Hearth: turns a plain sentence into task drafts, suggests a plan that the decision engine
 * checks before anyone sees it, and drafts messages. It never changes data itself: every result is a
 * suggestion the person accepts through the normal APIs.
 */
@SpringBootApplication(scanBasePackages = "com.hearth")
@EnableConfigurationProperties(AiProperties.class)
public class AiServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiServiceApplication.class, args);
    }
}
