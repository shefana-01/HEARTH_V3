package com.hearth.task.application;

import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.task.dto.TaskDtos.PlanningData;
import com.hearth.task.repository.PersonalEventRepository;
import com.hearth.task.repository.TaskRepository;
import com.hearth.task.repository.UnavailabilityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Everything about a family's time that the decision engine needs, in one call. Private items of other
 * people keep their time and owner (so clashes are found) but not what they are about.
 */
@Service
public class PlanningService {

    private final FamilyDirectory directory;
    private final TaskRepository tasks;
    private final PersonalEventRepository events;
    private final UnavailabilityRepository unavailability;

    public PlanningService(FamilyDirectory directory, TaskRepository tasks, PersonalEventRepository events, UnavailabilityRepository unavailability) {
        this.directory = directory;
        this.tasks = tasks;
        this.events = events;
        this.unavailability = unavailability;
    }

    @Transactional(readOnly = true)
    public PlanningData planning() {
        FamilyContext context = directory.context();
        return new PlanningData(
                tasks.findByFamilyIdOrderByStartAtAscIdAsc(context.familyId()).stream()
                        .map(task -> task.isVisibleTo(context.memberId()) ? TaskViews.view(task) : TaskViews.masked(task))
                        .toList(),
                events.findByFamilyIdOrderByStartAtAsc(context.familyId()).stream().map(event -> TaskViews.forViewer(event, context.memberId())).toList(),
                unavailability.findByFamilyIdOrderByStartAtAsc(context.familyId()).stream().map(TaskViews::view).toList());
    }
}
