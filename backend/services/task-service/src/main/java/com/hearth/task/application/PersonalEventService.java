package com.hearth.task.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import com.hearth.task.domain.PersonalEvent;
import com.hearth.task.dto.TaskDtos.EventInput;
import com.hearth.task.dto.TaskDtos.EventView;
import com.hearth.task.repository.PersonalEventRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Classes, work shifts and anything else on one person's own calendar. Only the owner can add, change or
 * remove their events. Others get them back with the title hidden when the owner chose "show as busy".
 * They write nothing to the activity log: someone's calendar is their own.
 */
@Service
public class PersonalEventService {

    private static final List<Boolean> NO_DAYS = List.of(false, false, false, false, false, false, false);

    private final FamilyDirectory directory;
    private final PersonalEventRepository events;

    public PersonalEventService(FamilyDirectory directory, PersonalEventRepository events) {
        this.directory = directory;
        this.events = events;
    }

    /** Events of one member (default: the caller), earliest first. */
    @Transactional(readOnly = true)
    public List<EventView> list(UUID memberId) {
        FamilyContext context = directory.context();
        UUID owner = memberId == null ? context.memberId() : memberId;
        if (!owner.equals(context.memberId()) && !People.isMember(directory, owner)) {
            throw ApiException.notFound("That family member");
        }
        return events.findByFamilyIdAndMemberIdOrderByStartAtAsc(context.familyId(), owner).stream().map(event -> TaskViews.forViewer(event, context.memberId())).toList();
    }

    @Transactional(readOnly = true)
    public EventView get(UUID id) {
        FamilyContext context = directory.context();
        PersonalEvent event = events.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That event"));
        return TaskViews.forViewer(event, context.memberId());
    }

    @Transactional
    public EventView create(EventInput input) {
        FamilyContext context = directory.context();
        PersonalEvent event = new PersonalEvent(context.familyId(), context.memberId());
        apply(event, input);
        events.save(event);
        return TaskViews.view(event);
    }

    @Transactional
    public EventView update(UUID id, EventInput input) {
        PersonalEvent event = own(directory.context(), id);
        apply(event, input);
        events.save(event);
        return TaskViews.view(event);
    }

    @Transactional
    public void remove(UUID id) {
        events.delete(own(directory.context(), id));
    }

    private PersonalEvent own(FamilyContext context, UUID id) {
        return events.findByIdAndFamilyId(id, context.familyId()).filter(event -> event.getMemberId().equals(context.memberId())).orElseThrow(() -> ApiException.notFound("That event"));
    }

    /** The same checks and clean-up as the offline demo (eventService.ts). */
    private static void apply(PersonalEvent event, EventInput input) {
        String title = Formats.trim(input.title());
        if (title.isEmpty()) {
            throw ApiException.unprocessable("Give the event a name.");
        }
        if (input.durationMin() < 5 || input.durationMin() > 1440) {
            throw ApiException.unprocessable("An event lasts between 5 minutes and 24 hours.");
        }
        boolean weekly = PersonalEvent.WEEKLY.equals(input.repeat());
        List<Boolean> days = input.days();
        if (weekly) {
            if (days == null || days.size() != 7 || days.stream().anyMatch(day -> day == null) || days.stream().noneMatch(Boolean::booleanValue)) {
                throw ApiException.unprocessable("Choose at least one day of the week.");
            }
            if (input.until() != null && input.until().isBefore(input.start())) {
                throw ApiException.unprocessable("The last day must be after the first one.");
            }
        }
        event.setTitle(title);
        event.setKind(input.kind());
        event.setStartAt(input.start());
        event.setDurationMin(input.durationMin());
        event.setRepeat(input.repeat());
        event.setDays(weekly ? List.copyOf(days) : NO_DAYS);
        event.setUntilAt(weekly ? input.until() : null);
        event.setLocation(Formats.trim(input.location()));
        event.setVisibility(input.visibility());
    }
}
