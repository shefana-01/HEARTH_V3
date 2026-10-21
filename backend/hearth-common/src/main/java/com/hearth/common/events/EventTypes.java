package com.hearth.common.events;

/**
 * Every event type Hearth publishes, in one place, so producers and consumers cannot drift apart.
 * The topic is the producing service's ({@link Topics}); the key is the family id.
 */
public final class EventTypes {

    /* family-service → hearth.family.events */
    public static final String FAMILY_CREATED = "family.created";
    public static final String FAMILY_UPDATED = "family.updated";
    public static final String MEMBER_INVITED = "member.invited";
    public static final String MEMBER_JOINED = "member.joined";
    public static final String MEMBER_UPDATED = "member.updated";
    /** data: memberId. Other services remove or unlink what belonged to the member. */
    public static final String MEMBER_REMOVED = "member.removed";
    public static final String MEMBER_STATUS_CHANGED = "member.status-changed";
    public static final String AVAILABILITY_UPDATED = "availability.updated";
    public static final String DEPENDANT_ADDED = "dependant.added";
    public static final String DEPENDANT_UPDATED = "dependant.updated";
    /** data: dependantId. Health notes go; tasks, documents and the shopping list lose the link. */
    public static final String DEPENDANT_REMOVED = "dependant.removed";

    /* task-service → hearth.task.events */
    public static final String TASK_CREATED = "task.created";
    public static final String TASK_UPDATED = "task.updated";
    public static final String TASK_COMPLETED = "task.completed";
    public static final String TASK_REOPENED = "task.reopened";
    /** data: taskId. Open handover requests for it are closed. */
    public static final String TASK_CANCELLED = "task.cancelled";
    /** data: taskId. The task became private: open handover requests for it are closed. */
    public static final String TASK_MADE_PRIVATE = "task.made-private";
    /** data: taskId, assigneeId, appointmentId. */
    public static final String TASK_ASSIGNED = "task.assigned";
    public static final String TASK_CONFLICT_KEPT = "task.conflict-kept";
    public static final String TASK_REMINDER = "task.reminder";
    /** data: unavailabilityId, memberId, reason, note, taskIds (shared tasks that now need someone else). */
    public static final String UNAVAILABILITY_REPORTED = "unavailability.reported";
    public static final String UNAVAILABILITY_REMOVED = "unavailability.removed";

    /* decision-service → hearth.decision.events */
    public static final String HANDOVER_REQUESTED = "handover.requested";
    /** data: requestId, taskId, memberId, appointmentId. */
    public static final String HANDOVER_APPROVED = "handover.approved";
    public static final String HANDOVER_CANCELLED = "handover.cancelled";
    public static final String PLAN_CHANGED = "plan.changed";

    /* care-service → hearth.care.events */
    public static final String APPOINTMENT_CREATED = "appointment.created";
    /** data: appointmentId, escortId, forId, visibility. Linked shared tasks follow the escort. */
    public static final String APPOINTMENT_UPDATED = "appointment.updated";
    /** data: appointmentId. Tasks linked to it lose the link. */
    public static final String APPOINTMENT_REMOVED = "appointment.removed";
    public static final String APPOINTMENT_REMINDER = "appointment.reminder";
    public static final String DOCUMENT_UPLOADED = "document.uploaded";
    public static final String DOCUMENT_ACCESS_CHANGED = "document.access-changed";
    public static final String DOCUMENT_DELETED = "document.deleted";
    public static final String HEALTH_UPDATED = "health.updated";
    public static final String GROCERY_TASK_CREATED = "grocery.task-created";

    private EventTypes() {
    }
}
