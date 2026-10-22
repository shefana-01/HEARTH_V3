package com.hearth.family.api;

import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.family.application.LocalFamilyDirectory;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * For the other services only (the gateway does not route {@code /internal}). They forward the caller's
 * token, so each answer is about the caller's own family.
 */
@RestController
@RequestMapping("/api/v1/internal")
public class InternalController {

    private final LocalFamilyDirectory directory;

    public InternalController(LocalFamilyDirectory directory) {
        this.directory = directory;
    }

    /** Who the caller is in their family: member id, role, access and the family's time zone. */
    @GetMapping("/context")
    public FamilyContext context() {
        return directory.context();
    }

    @GetMapping("/dependants")
    public List<DependantRef> dependants() {
        return directory.dependants();
    }
}
