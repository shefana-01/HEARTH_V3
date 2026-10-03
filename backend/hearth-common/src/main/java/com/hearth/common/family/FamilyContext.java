package com.hearth.common.family;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hearth.common.error.ApiException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Who is calling and which family they belong to. Resolved by family-service
 * for every request, so a caller can never read another family's data.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FamilyContext(
        UUID accountId,
        UUID memberId,
        String memberName,
        UUID familyId,
        String role,
        boolean scheduleAccess,
        boolean medicalAccess,
        boolean documentsAccess,
        String timezone) {

    @JsonIgnore
    public boolean isLead() {
        return "lead".equals(role);
    }

    @JsonIgnore
    public boolean isObserver() {
        return "observer".equals(role);
    }

    /** Observers can read everything they are allowed to see but cannot change it. */
    public void requireContributor() {
        if (isObserver()) {
            throw ApiException.forbidden("Observers can view the plan but cannot change it.");
        }
    }

    public void requireLead() {
        if (!isLead()) {
            throw ApiException.forbidden("Only the lead caregiver can do this.");
        }
    }

    public ZoneId zone() {
        try {
            return timezone == null || timezone.isBlank() ? ZoneOffset.UTC : ZoneId.of(timezone);
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }
}
