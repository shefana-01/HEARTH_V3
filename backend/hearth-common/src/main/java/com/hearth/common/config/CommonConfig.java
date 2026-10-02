package com.hearth.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on scheduling, which the outbox relay uses. */
@Configuration
@EnableScheduling
public class CommonConfig {
}
