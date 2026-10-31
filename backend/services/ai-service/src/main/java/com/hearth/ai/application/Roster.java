package com.hearth.ai.application;

import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.MemberRef;
import com.hearth.common.family.Names;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The family as the model sees it: first names under short aliases ({@code m1}, {@code d1}). Real ids never
 * leave Hearth, and an alias the model invents simply does not resolve. The caller is always {@code m1}.
 */
public final class Roster {

    /** One person: alias, first name, how they relate, whether tasks can be given to them. */
    public record Person(String alias, UUID id, String firstName, String kind, boolean takesTasks) {
    }

    private final Map<String, Person> byAlias = new LinkedHashMap<>();
    private final Map<UUID, Person> byId = new LinkedHashMap<>();

    public Roster(FamilyContext caller, List<MemberRef> members, List<DependantRef> dependants) {
        List<MemberRef> ordered = new ArrayList<>(members.stream().filter(m -> m.id().equals(caller.memberId())).toList());
        members.stream().filter(m -> !m.id().equals(caller.memberId()) && m.isActive()).forEach(ordered::add);
        int n = 1;
        for (MemberRef member : ordered) {
            add(new Person("m" + n++, member.id(), member.firstName(), "member", member.canTakeTasks()));
        }
        if (byId.isEmpty() || !byId.containsKey(caller.memberId())) {
            add(new Person("m" + n, caller.memberId(), Names.first(caller.memberName()), "member", !caller.isObserver()));
        }
        int d = 1;
        for (DependantRef dependant : dependants) {
            add(new Person("d" + d++, dependant.id(), Names.first(dependant.name()), "looked-after" + (dependant.relation() == null || dependant.relation().isBlank() ? "" : " (" + dependant.relation() + ")"), false));
        }
    }

    private void add(Person person) {
        byAlias.put(person.alias(), person);
        byId.put(person.id(), person);
    }

    public Optional<Person> alias(String alias) {
        return alias == null ? Optional.empty() : Optional.ofNullable(byAlias.get(alias.trim().toLowerCase()));
    }

    public Optional<Person> id(UUID id) {
        return id == null ? Optional.empty() : Optional.ofNullable(byId.get(id));
    }

    public String aliasOf(UUID id) {
        return id(id).map(Person::alias).orElse(null);
    }

    public List<Person> people() {
        return List.copyOf(byAlias.values());
    }

    /** One line per person, for the prompt. */
    public String describe() {
        StringBuilder text = new StringBuilder();
        for (Person person : byAlias.values()) {
            text.append("- ").append(person.alias()).append(": ").append(person.firstName()).append(", ").append(person.kind());
            if ("member".equals(person.kind()) && !person.takesTasks()) {
                text.append(", cannot take tasks");
            }
            if (person.alias().equals("m1")) {
                text.append(" (the person asking)");
            }
            text.append('\n');
        }
        return text.toString();
    }
}
