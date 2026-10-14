package com.hearth.care.application;

import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Patient;
import com.hearth.care.dto.CareDtos.*;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.care.infrastructure.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HealthcareService {

    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;

    @Transactional
    public Patient createPatient(CreatePatientRequest request) {
        Patient patient = Patient.builder()
                .familyId(request.getFamilyId())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .dateOfBirth(request.getDateOfBirth())
                .primaryCaregiverId(request.getPrimaryCaregiverId())
                .build();
        return patientRepository.save(patient);
    }

    public List<Patient> getPatientsByFamily(UUID familyId) {
        return patientRepository.findByFamilyId(familyId);
    }

    @Transactional
    public Appointment createAppointment(CreateAppointmentRequest request) {
        Patient patient = patientRepository.findById(request.getPatientId()).orElse(null);
        UUID familyId = patient != null ? patient.getFamilyId() : UUID.randomUUID();

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setFamilyId(familyId);
        appointment.setForId(request.getPatientId());
        appointment.setEscortId(request.getCaregiverId());
        appointment.setTitle(request.getTitle());
        appointment.setLocation(request.getLocation() != null ? request.getLocation() : "");
        appointment.setStartAt(request.getScheduledTime());
        appointment.setDurationMin(request.getDurationMinutes() != null ? request.getDurationMinutes() : 60);
        appointment.setVisibility(Appointment.FAMILY);
        appointment.setNote(request.getNotes() != null ? request.getNotes() : "");
        appointment.setCreatedAt(Instant.now());
        appointment.setCreatedById(request.getCaregiverId() != null ? request.getCaregiverId() : UUID.randomUUID());
        return appointmentRepository.save(appointment);
    }

    public List<Appointment> getAppointmentsByPatient(UUID patientId) {
        return appointmentRepository.findByForId(patientId);
    }
}
