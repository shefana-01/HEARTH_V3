package com.hearth.task.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.Names;
import com.hearth.common.text.Formats;
import com.hearth.task.domain.Task;
import com.hearth.task.domain.Unavailability;
import com.hearth.task.dto.TaskDtos.UnavailabilityInput;
import com.hearth.task.dto.TaskDtos.UnavailabilityResult;
import com.hearth.task.dto.TaskDtos.UnavailabilityView;
import com.hearth.task.repository.TaskRepository;
import com.hearth.task.repository.UnavailabilityRepository;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "I can't make it": time the caller cannot cover. Saving it publishes {@code unavailability.reported};
 * decision-service then opens a handover request for every shared task of theirs in that time. That is
 * the one eventually consistent step: the answer comes at once, the requests a moment later.
 */
@Service
public class UnavailabilityService {

    private final FamilyDirectory directory;
    private final UnavailabilityRepository unavailability;
    private final TaskRepository tasks;
    private final EventPublisher events;

    public UnavailabilityService(FamilyDirectory directory, UnavailabilityRepository unavailability, TaskRepository tasks, EventPublisher events) {
        this.directory = directory;
        this.unavailability = unavailability;
        this.tasks = tasks;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<UnavailabilityView> list(UUID memberId) {
        FamilyContext context = directory.context();
        List<Unavailability> found = memberId == null
                ? unavailability.findByFamilyIdOrderByStartAtAsc(context.familyId())
                : unavailability.findByFamilyIdAndMemberIdOrderByStartAtAsc(context.familyId(), memberId);
        return found.stream().map(TaskViews::view).toList();
    }

    @Transactional
    public UnavailabilityResult report(UnavailabilityInput input) {
        FamilyContext context = directory.context();
        if (!input.end().isAfter(input.start())) {
            throw ApiException.unprocessable("The end time must be after the start time.");
        }
        if (Duration.between(input.start(), input.end()).toDays() > 366) {
            throw ApiException.unprocessable("Time away can be up to a year at once.");
        }
        String reason = Formats.trim(input.reason());
        Unavailability away = new Unavailability(context.familyId(), context.memberId(), input.start(), input.end(), reason, Formats.trim(input.note()));
        unavailability.save(away);

        List<Task> inWindow = tasks.findScheduledStartingBefore(context.familyId(), context.memberId(), input.end()).stream()
                .filter(task -> task.getEndAt().isAfter(input.start()))
                .toList();
        List<UUID> affected = inWindow.stream().filter(Task::isShared).map(Task::getId).toList();
        List<UUID> personal = inWindow.stream().filter(task -> !task.isShared()).map(Task::getId).toList();

        String first = Names.first(context.memberName());
        String span = Formats.dayTime(input.start(), context.zone()) + " – " + Formats.dayTime(input.end(), context.zone());
        String needs = affected.isEmpty() ? "" : " — " + affected.size() + (affected.size() == 1 ? " task needs" : " tasks need") + " someone else";
        events.publish(Topics.TASK, Events.of(EventTypes.UNAVAILABILITY_REPORTED, context)
                .audit("schedule", "Reported time away", span, null, reason.isEmpty() ? null : reason)
                .notify("availability", first + " can’t make it " + span + needs + ".", "/priority")
                .data("unavailabilityId", away.getId())
                .data("memberId", context.memberId())
                .data("taskIds", affected)
                .data("note", away.getNote())
                // decision-service has no user to ask for names when it handles the event, so the wording travels with it.
                .data("requestReason", reason.isEmpty() ? first + " is unavailable." : first + " is unavailable (" + reason.toLowerCase(Locale.ROOT) + ").")
                .build());
        return new UnavailabilityResult(TaskViews.view(away), affected, List.of(), personal);
    }

    /** Your own time away; the organiser can remove anyone's. */
    @Transactional
    public void remove(UUID id) {
        FamilyContext context = directory.context();
        Unavailability away = unavailability.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That time away"));
        if (!away.getMemberId().equals(context.memberId()) && !context.isLead()) {
            throw ApiException.forbidden("You can only remove your own time away.");
        }
        unavailability.delete(away);
        events.publish(Topics.TASK, Events.of(EventTypes.UNAVAILABILITY_REMOVED, context).data("unavailabilityId", away.getId()).data("memberId", away.getMemberId()).build());
    }
}
