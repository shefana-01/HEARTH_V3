package com.hearth.task.api;

import com.hearth.task.application.UnavailabilityService;
import com.hearth.task.dto.TaskDtos.UnavailabilityInput;
import com.hearth.task.dto.TaskDtos.UnavailabilityResult;
import com.hearth.task.dto.TaskDtos.UnavailabilityView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Time someone cannot cover ("I can't make it"). */
@RestController
@RequestMapping("/api/v1/unavailability")
public class UnavailabilityController {

    private final UnavailabilityService unavailability;

    public UnavailabilityController(UnavailabilityService unavailability) {
        this.unavailability = unavailability;
    }

    @GetMapping
    public List<UnavailabilityView> list(@RequestParam(required = false) UUID memberId) {
        return unavailability.list(memberId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UnavailabilityResult report(@Valid @RequestBody UnavailabilityInput input) {
        return unavailability.report(input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        unavailability.remove(id);
    }
}
