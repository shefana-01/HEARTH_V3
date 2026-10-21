package com.hearth.task;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Tasks, personal events, time away and task reminders. */
@SpringBootApplication(scanBasePackages = "com.hearth")
public class TaskServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TaskServiceApplication.class, args);
    }
}
