package com.hearth.common.family;

import java.util.List;

/**
 * Looks up the caller's family. family-service answers from its own database;
 * every other service asks family-service ({@link RemoteFamilyDirectory}).
 */
public interface FamilyDirectory {

    /** The caller's membership. Fails with 409 if they have not set up or joined a family yet. */
    FamilyContext context();

    /** Everyone in the caller's family. */
    List<MemberRef> members();
}
