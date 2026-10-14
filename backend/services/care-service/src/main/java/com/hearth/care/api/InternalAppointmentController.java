package com.hearth.care.api;

import com.hearth.care.dto.CareDtos.AppointmentView;
import com.hearth.care.application.AppointmentService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * For other services only. The gateway does not route {@code /internal}, and the caller's token is still
 * required, so the answer is always about the caller's own family.
 */
@RestController
@RequestMapping("/api/v1/internal/appointments")
public class InternalAppointmentController {

    private final AppointmentService appointments;

    public InternalAppointmentController(AppointmentService appointments) {
        this.appointments = appointments;
    }

    /** Every appointment of the family; what a private one is about is blanked unless the caller is involved. */
    @GetMapping
    public List<AppointmentView> all() {
        return appointments.listForPlanning();
    }
}
