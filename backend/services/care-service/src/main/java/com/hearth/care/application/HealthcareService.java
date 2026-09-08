package com.hearth.care.application;

import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Patient;
import com.hearth.care.dto.CareDtos.*;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.care.infrastructure.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        Appointment appointment = Appointment.builder()
                .patientId(request.getPatientId())
                .caregiverId(request.getCaregiverId())
                .title(request.getTitle())
                .location(request.getLocation())
                .scheduledTime(request.getScheduledTime())
                .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 60)
                .status("SCHEDULED")
                .notes(request.getNotes())
                .build();
        return appointmentRepository.save(appointment);
    }

    public List<Appointment> getAppointmentsByPatient(UUID patientId) {
        return appointmentRepository.findByPatientId(patientId);
    }
}
