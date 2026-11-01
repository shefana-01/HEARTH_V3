package com.hearth.care.medicine;

import com.hearth.care.medicine.MedicineDtos.DoseInput;
import com.hearth.care.medicine.MedicineDtos.DoseView;
import com.hearth.care.medicine.MedicineDtos.EmergencyInput;
import com.hearth.care.medicine.MedicineDtos.EmergencyView;
import com.hearth.care.medicine.MedicineDtos.MedicationInput;
import com.hearth.care.medicine.MedicineDtos.MedicationView;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Medicine schedules, doses, and emergency-card details. */
@RestController
public class MedicineController {

    private final MedicationService medications;
    private final EmergencyService emergency;

    public MedicineController(MedicationService medications, EmergencyService emergency) {
        this.medications = medications;
        this.emergency = emergency;
    }

    @GetMapping("/api/v1/medications")
    public List<MedicationView> list(@RequestParam(required = false) UUID personId) {
        return medications.list(personId);
    }

    @PostMapping("/api/v1/medications")
    @ResponseStatus(HttpStatus.CREATED)
    public MedicationView create(@Valid @RequestBody MedicationInput input) {
        return medications.create(input);
    }

    @PutMapping("/api/v1/medications/{id}")
    public MedicationView update(@PathVariable UUID id, @Valid @RequestBody MedicationInput input) {
        return medications.update(id, input);
    }

    @DeleteMapping("/api/v1/medications/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        medications.delete(id);
    }

    /** Scheduled doses in a time range (at most 62 days), with whether each was taken, skipped or missed. */
    @GetMapping("/api/v1/medications/doses")
    public List<DoseView> doses(@RequestParam Instant from, @RequestParam Instant to, @RequestParam(required = false) UUID personId) {
        return medications.doses(from, to, personId);
    }

    @PostMapping("/api/v1/medications/{id}/doses")
    public DoseView record(@PathVariable UUID id, @Valid @RequestBody DoseInput input) {
        return medications.record(id, input);
    }

    @GetMapping("/api/v1/health/emergency/{personId}")
    public EmergencyView emergency(@PathVariable UUID personId) {
        return emergency.get(personId);
    }

    @PutMapping("/api/v1/health/emergency/{personId}")
    public EmergencyView saveEmergency(@PathVariable UUID personId, @Valid @RequestBody EmergencyInput input) {
        return emergency.save(personId, input);
    }
}
