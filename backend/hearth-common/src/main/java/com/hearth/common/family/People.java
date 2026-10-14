package com.hearth.common.family;

import java.util.List;
import java.util.UUID;

/** Helpers for "a person": a family member or someone the family looks after. */
public final class People {

    private People() {
    }

    public static boolean isMember(FamilyDirectory directory, UUID id) {
        return id != null && directory.members().stream().anyMatch(m -> m.id().equals(id));
    }

    public static boolean isDependant(FamilyDirectory directory, UUID id) {
        return id != null && directory.dependants().stream().anyMatch(d -> d.id().equals(id));
    }

    /** True if the id is a member or a dependant of the caller's family. */
    public static boolean exists(FamilyDirectory directory, UUID id) {
        return isMember(directory, id) || isDependant(directory, id);
    }

    /** Full name of a member or dependant; "Someone" if they are no longer in the family. */
    public static String name(FamilyDirectory directory, UUID id) {
        if (id == null) {
            return Names.UNASSIGNED;
        }
        List<MemberRef> members = directory.members();
        return members.stream().filter(m -> m.id().equals(id)).map(MemberRef::name).findFirst()
                .orElseGet(() -> directory.dependants().stream().filter(d -> d.id().equals(id)).map(DependantRef::name).findFirst().orElse("Someone"));
    }

    public static String firstName(FamilyDirectory directory, UUID id) {
        return Names.first(name(directory, id));
    }
}
