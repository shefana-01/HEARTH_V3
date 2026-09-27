package com.hearth.common.family;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.UUID;

/** The parts of a family member other services need (names, role, skills, availability). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MemberRef(UUID id, String name, String role, String status, List<String> skills, Availability availability) {

    public String firstName() {
        return Names.first(name);
    }

    @JsonIgnore
    public boolean isActive() {
        return "active".equals(status);
    }

    public boolean canTakeTasks() {
        return isActive() && !"observer".equals(role);
    }

    public List<String> skillsOrEmpty() {
        return skills == null ? List.of() : skills;
    }

    public Availability availabilityOrDefault() {
        return availability == null ? Availability.weekdays() : availability;
    }
}
