package com.hearth.care.api;

import com.hearth.care.application.AppointmentService;
import com.hearth.care.dto.CareDtos.AppointmentInput;
import com.hearth.care.dto.CareDtos.AppointmentView;
import com.hearth.care.dto.CareDtos.PrepLabel;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentController {

    private final AppointmentService appointments;

    public AppointmentController(AppointmentService appointments) {
        this.appointments = appointments;
    }

    @GetMapping
    public List<AppointmentView> list() {
        return appointments.list();
    }

    @GetMapping("/{id}")
    public AppointmentView get(@PathVariable UUID id) {
        return appointments.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppointmentView create(@Valid @RequestBody AppointmentInput input) {
        return appointments.create(input);
    }

    @PutMapping("/{id}")
    public AppointmentView update(@PathVariable UUID id, @Valid @RequestBody AppointmentInput input) {
        return appointments.update(id, input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        appointments.remove(id);
    }

    @PostMapping("/{id}/prep")
    public AppointmentView addPrep(@PathVariable UUID id, @Valid @RequestBody PrepLabel request) {
        return appointments.addPrep(id, request.label());
    }

    @PostMapping("/{id}/prep/{prepId}/toggle")
    public AppointmentView togglePrep(@PathVariable UUID id, @PathVariable String prepId) {
        return appointments.togglePrep(id, prepId);
    }

    @DeleteMapping("/{id}/prep/{prepId}")
    public AppointmentView removePrep(@PathVariable UUID id, @PathVariable String prepId) {
        return appointments.removePrep(id, prepId);
    }
}
