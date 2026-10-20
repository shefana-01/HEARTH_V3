package com.hearth.task.api;

import com.hearth.task.application.PersonalEventService;
import com.hearth.task.dto.TaskDtos.EventInput;
import com.hearth.task.dto.TaskDtos.EventView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Personal events: classes, work shifts and anything else on one person's own calendar. */
@RestController
@RequestMapping("/api/v1/events")
public class PersonalEventController {

    private final PersonalEventService events;

    public PersonalEventController(PersonalEventService events) {
        this.events = events;
    }

    @GetMapping
    public List<EventView> list(@RequestParam(required = false) UUID memberId) {
        return events.list(memberId);
    }

    @GetMapping("/{id}")
    public EventView get(@PathVariable UUID id) {
        return events.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventView create(@Valid @RequestBody EventInput input) {
        return events.create(input);
    }

    @PutMapping("/{id}")
    public EventView update(@PathVariable UUID id, @Valid @RequestBody EventInput input) {
        return events.update(id, input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        events.remove(id);
    }
}
