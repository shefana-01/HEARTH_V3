package com.hearth.care.api;

import com.hearth.care.application.HealthcareService;
import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Patient;
import com.hearth.care.dto.CareDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/care")
@RequiredArgsConstructor
public class CareController {

    private final HealthcareService healthcareService;

    @PostMapping("/patients")
    public ResponseEntity<Patient> createPatient(@Valid @RequestBody CreatePatientRequest request) {
        return ResponseEntity.ok(healthcareService.createPatient(request));
    }

    @GetMapping("/families/{familyId}/patients")
    public ResponseEntity<List<Patient>> getPatientsByFamily(@PathVariable UUID familyId) {
        return ResponseEntity.ok(healthcareService.getPatientsByFamily(familyId));
    }

    @PostMapping("/appointments")
    public ResponseEntity<Appointment> createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        return ResponseEntity.ok(healthcareService.createAppointment(request));
    }

    @GetMapping("/patients/{patientId}/appointments")
    public ResponseEntity<List<Appointment>> getAppointmentsByPatient(@PathVariable UUID patientId) {
        return ResponseEntity.ok(healthcareService.getAppointmentsByPatient(patientId));
    }
}
