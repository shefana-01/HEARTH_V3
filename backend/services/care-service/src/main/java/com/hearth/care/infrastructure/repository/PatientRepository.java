package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.Appointment;
import com.hearth.care.domain.Patient;
import com.hearth.care.domain.NutritionGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {
    List<Patient> findByFamilyId(UUID familyId);
}
