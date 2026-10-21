package com.hearth.family.application;

import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import com.hearth.family.repository.DependantRepository;
import com.hearth.family.repository.MemberRepository;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * family-service answers "who is calling" from its own database. Every other service asks it over HTTP
 * ({@code RemoteFamilyDirectory}), through the internal endpoints that use this class.
 */
@Component
public class LocalFamilyDirectory implements FamilyDirectory {

    private final Caller caller;
    private final MemberRepository members;
    private final DependantRepository dependants;

    public LocalFamilyDirectory(Caller caller, MemberRepository members, DependantRepository dependants) {
        this.caller = caller;
        this.members = members;
        this.dependants = dependants;
    }

    @Override
    @Transactional(readOnly = true)
    public FamilyContext context() {
        return caller.membership().context();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MemberRef> members() {
        return members.findByFamilyIdOrderByJoinedAtAsc(context().familyId()).stream()
                .map(m -> new MemberRef(m.getId(), m.getName(), m.getRole(), m.getStatus(), List.copyOf(m.getSkills()), m.getAvailability()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DependantRef> dependants() {
        return dependants.findByFamilyIdOrderByCreatedAtAsc(context().familyId()).stream()
                .map(d -> new DependantRef(d.getId(), d.getName(), d.getRelation()))
                .toList();
    }
}
