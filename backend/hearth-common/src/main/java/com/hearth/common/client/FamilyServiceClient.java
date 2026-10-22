package com.hearth.common.client;

import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.MemberRef;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * HEAR-468: Declarative client contract for family-service.
 * Provides internal context, member directory, and dependants listing.
 */
public interface FamilyServiceClient {

    @GetMapping("/api/v1/internal/context")
    FamilyContext getContext();

    @GetMapping("/api/v1/members")
    List<MemberRef> getMembers();

    @GetMapping("/api/v1/internal/dependants")
    List<DependantRef> getDependants();
}
