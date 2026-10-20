package com.hearth.decision.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.DependantRef;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import com.hearth.common.http.ServiceClient;
import com.hearth.decision.engine.Model.Appointment;
import com.hearth.decision.engine.Model.EngineData;
import com.hearth.decision.engine.Model.Member;
import com.hearth.decision.engine.Model.PersonalEvent;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.engine.Model.Unavailability;
import com.hearth.decision.engine.Recurrence;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Gathers what the decision engine needs, as the caller: members from family-service, tasks, personal
 * events and time away from task-service, appointments from care-service. Those services already hide
 * what a private item is about from anyone who may not see it; times and people stay real, so clashes
 * with private commitments are still found.
 */
@Component
public class Planning {

    /** One look at the family's plan, for one caller. */
    public record Snapshot(FamilyContext context, EngineData data, List<PersonalEvent> events, List<DependantRef> dependants, Instant now) {

        public String me() {
            return context.memberId().toString();
        }

        public Optional<Task> task(String id) {
            return data.tasks().stream().filter(t -> t.id().equals(id)).findFirst();
        }

        /** A task the caller may see: shared, theirs, or written down by them. */
        public Optional<Task> visibleTask(String id) {
            return task(id).filter(t -> !t.isPrivate() || me().equals(t.assigneeId()) || me().equals(t.createdById()));
        }

        public Optional<Member> member(String id) {
            return data.members().stream().filter(m -> m.id().equals(id)).findFirst();
        }

        /** Full name of a member or dependant; "Unassigned" for nobody, "Someone" for a person no longer in the family. */
        public String name(String id) {
            if (id == null) {
                return "Unassigned";
            }
            return member(id).map(Member::name).orElseGet(() -> dependants.stream().filter(d -> d.id().toString().equals(id)).map(DependantRef::name).findFirst().orElse("Someone"));
        }

        public String memberName(String id) {
            return id == null ? "Unassigned" : member(id).map(Member::name).orElse("Unassigned");
        }

        public String firstName(String id) {
            return memberName(id).split(" ", -1)[0];
        }
    }

    private final FamilyDirectory directory;
    private final ServiceClient services;
    private final ObjectMapper mapper;
    private final String taskServiceUrl;
    private final String careServiceUrl;

    public Planning(FamilyDirectory directory, ServiceClient services, ObjectMapper mapper, @Value("${hearth.services.task}") String taskServiceUrl, @Value("${hearth.services.care}") String careServiceUrl) {
        this.directory = directory;
        this.services = services;
        this.mapper = mapper;
        this.taskServiceUrl = taskServiceUrl;
        this.careServiceUrl = careServiceUrl;
    }

    public Snapshot load() {
        FamilyContext context = directory.context();
        Instant now = Instant.now();
        JsonNode planning = services.get(taskServiceUrl + "/api/v1/internal/planning", JsonNode.class);
        JsonNode appointments = services.get(careServiceUrl + "/api/v1/internal/appointments", JsonNode.class);

        List<Member> members = new ArrayList<>();
        for (MemberRef m : directory.members()) {
            members.add(new Member(m.id().toString(), m.name(), m.role(), m.status(), m.skillsOrEmpty(), m.availabilityOrDefault()));
        }
        List<Task> tasks = read(planning.path("tasks"), Task.class);
        List<PersonalEvent> events = read(planning.path("events"), PersonalEvent.class);
        List<Unavailability> away = read(planning.path("unavailability"), Unavailability.class);
        List<Appointment> visits = read(appointments, Appointment.class);

        Set<String> calendarOwners = new LinkedHashSet<>();
        events.forEach(e -> calendarOwners.add(e.memberId()));
        EngineData data = new EngineData(
                tasks,
                visits,
                members,
                away,
                Recurrence.expand(events, now.minus(Recurrence.LOOKBACK), now.plus(Recurrence.HORIZON), context.zone()),
                calendarOwners,
                context.memberId().toString(),
                context.zone());
        return new Snapshot(context, data, events, directory.dependants(), now);
    }

    private <T> List<T> read(JsonNode array, Class<T> type) {
        List<T> items = new ArrayList<>();
        if (array == null || !array.isArray()) {
            return items;
        }
        for (JsonNode item : array) {
            try {
                items.add(mapper.treeToValue(item, type));
            } catch (Exception ex) {
                throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "Part of Hearth sent something unexpected. Please try again.");
            }
        }
        return items;
    }

    static UUID uuid(String id) {
        return id == null ? null : UUID.fromString(id);
    }
}
