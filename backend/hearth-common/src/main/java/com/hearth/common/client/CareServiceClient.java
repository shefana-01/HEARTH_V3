package com.hearth.common.client;

import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * HEAR-468: Declarative client contract for care-service.
 * Allows decision-service and gateway to query appointment windows and prep items.
 */
public interface CareServiceClient {

    @GetMapping("/api/v1/internal/appointments")
    List<?> getAppointments(
            @RequestParam("familyId") UUID familyId,
            @RequestParam("start") String start,
            @RequestParam("end") String end);
}
