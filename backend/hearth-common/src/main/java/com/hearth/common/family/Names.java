package com.hearth.common.family;

import java.util.List;
import java.util.UUID;

public final class Names {

    public static final String UNASSIGNED = "Unassigned";

    private Names() {
    }

    public static String first(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return UNASSIGNED;
        }
        return fullName.trim().split(" ")[0];
    }

    public static String of(List<MemberRef> members, UUID id) {
        if (id == null) {
            return UNASSIGNED;
        }
        return members.stream().filter(m -> m.id().equals(id)).map(MemberRef::name).findFirst().orElse(UNASSIGNED);
    }

    public static String firstOf(List<MemberRef> members, UUID id) {
        return first(of(members, id));
    }
}
