package com.hearth.decision.api;

import com.hearth.decision.application.WeekService;
import com.hearth.decision.dto.DecisionDtos.ScheduleEvent;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The family's week view. */
@RestController
@RequestMapping("/api/v1/schedule")
public class ScheduleController {

    private final WeekService week;

    public ScheduleController(WeekService week) {
        this.week = week;
    }

    @GetMapping("/events")
    public List<ScheduleEvent> events(@RequestParam Instant from, @RequestParam Instant to) {
        return week.between(from, to);
    }
}
