package com.hearth.common.testing;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.Availability;
import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A family held in memory, for service tests: stands in for family-service. {@link #signInAs} chooses who
 * the "current caller" is; {@link #reset} starts a new family.
 */
public class FakeFamilyDirectory implements FamilyDirectory {

    /** One member's details and what they may see. */
    public record Person(MemberRef ref, boolean medical, boolean documents) {
    }

    private UUID familyId = UUID.randomUUID();
    private String timezone = "Asia/Dhaka";
    private final Map<UUID, Person> members = new LinkedHashMap<>();
    private final List<DependantRef> dependants = new ArrayList<>();
    private UUID current;

    public synchronized FakeFamilyDirectory reset() {
        familyId = UUID.randomUUID();
        timezone = "Asia/Dhaka";
        members.clear();
        dependants.clear();
        current = null;
        return this;
    }

    public synchronized UUID addMember(String name, String role) {
        return addMember(name, role, List.of(), new Availability(List.of(true, true, true, true, true, true, true), List.of()), "lead".equals(role), "lead".equals(role));
    }

    public synchronized UUID addMember(String name, String role, List<String> skills, Availability availability, boolean medical, boolean documents) {
        UUID id = UUID.randomUUID();
        members.put(id, new Person(new MemberRef(id, name, role, "active", skills, availability), medical, documents));
        if (current == null) {
            current = id;
        }
        return id;
    }

    public synchronized UUID addDependant(String name, String relation) {
        UUID id = UUID.randomUUID();
        dependants.add(new DependantRef(id, name, relation));
        return id;
    }

    public synchronized void removeMember(UUID id) {
        members.remove(id);
    }

    public synchronized void signInAs(UUID memberId) {
        current = memberId;
    }

    public synchronized void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public synchronized UUID familyId() {
        return familyId;
    }

    public synchronized UUID current() {
        return current;
    }

    @Override
    public synchronized FamilyContext context() {
        Person person = current == null ? null : members.get(current);
        if (person == null) {
            throw ApiException.conflict("Set up your family space first.");
        }
        MemberRef ref = person.ref();
        return new FamilyContext(UUID.randomUUID(), ref.id(), ref.name(), familyId, ref.role(), true, person.medical() || "lead".equals(ref.role()), person.documents() || "lead".equals(ref.role()), timezone);
    }

    @Override
    public synchronized List<MemberRef> members() {
        return members.values().stream().map(Person::ref).toList();
    }

    @Override
    public synchronized List<DependantRef> dependants() {
        return List.copyOf(dependants);
    }
}
