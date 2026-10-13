package com.hearth.common.family;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

/**
 * Someone the family looks after who does not use Hearth themselves (a child,
 * a grandparent). Tasks, appointments, documents and health notes can be about them.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DependantRef(UUID id, String name, String relation) {
}
