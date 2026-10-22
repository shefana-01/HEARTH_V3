package com.hearth.care.api;

import com.hearth.care.application.HealthService;
import com.hearth.care.dto.CareDtos.FoodSuggestion;
import com.hearth.care.dto.CareDtos.HealthProfileInput;
import com.hearth.care.dto.CareDtos.HealthProfileView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Health notes and the everyday foods suggested from them. */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final HealthService health;

    public HealthController(HealthService health) {
        this.health = health;
    }

    @GetMapping("/profiles")
    public List<HealthProfileView> list() {
        return health.list();
    }

    @GetMapping("/profiles/{personId}")
    public HealthProfileView get(@PathVariable UUID personId) {
        return health.get(personId);
    }

    @PutMapping("/profiles/{personId}")
    public HealthProfileView save(@PathVariable UUID personId, @Valid @RequestBody HealthProfileInput input) {
        return health.save(personId, input);
    }

    @GetMapping("/suggestions")
    public List<FoodSuggestion> suggestions(@RequestParam(required = false) UUID personId) {
        return health.suggestions(personId);
    }
}
