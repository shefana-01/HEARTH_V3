package com.hearth.notification.service;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.notification.dto.NotificationView;
import com.hearth.notification.entity.Notification;
import com.hearth.notification.entity.NotificationState;
import com.hearth.notification.repository.NotificationRepository;
import com.hearth.notification.repository.NotificationStateRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    /** How many of a member's most recent notifications are listed. */
    private static final int RECENT = 200;

    private final FamilyDirectory directory;
    private final NotificationRepository notifications;
    private final NotificationStateRepository states;
    private final boolean includeOwnActions;

    public NotificationService(
            FamilyDirectory directory,
            NotificationRepository notifications,
            NotificationStateRepository states,
            @Value("${hearth.notifications.include-own-actions:false}") boolean includeOwnActions) {
        this.directory = directory;
        this.notifications = notifications;
        this.states = states;
        this.includeOwnActions = includeOwnActions;
    }

    /**
     * The caller's notifications, newest first: the ones addressed to them and the family-wide ones (minus their
     * own actions), without the ones they dismissed.
     */
    @Transactional(readOnly = true)
    public List<NotificationView> list() {
        FamilyContext context = directory.context();
        List<Notification> recent = visible(context);
        Map<UUID, NotificationState> stateById = statesFor(context, recent);

        List<NotificationView> views = new ArrayList<>();
        for (Notification notification : recent) {
            NotificationState state = stateById.get(notification.getId());
            if (state != null && state.isDismissed()) {
                continue;
            }
            views.add(new NotificationView(notification.getId(), notification.getType(), notification.getMessage(), notification.getCreatedAt(), state != null && state.isMarkedRead(), notification.getHref(), notification.getRecipientMemberId()));
        }
        return views;
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return list().stream().filter(view -> !view.read()).count();
    }

    @Transactional
    public void markRead(UUID id) {
        FamilyContext context = directory.context();
        NotificationState state = stateOf(context, id);
        state.setMarkedRead(true);
        states.save(state);
    }

    @Transactional
    public void markAllRead() {
        FamilyContext context = directory.context();
        List<Notification> recent = visible(context);
        Map<UUID, NotificationState> stateById = statesFor(context, recent);
        List<NotificationState> changed = new ArrayList<>();
        for (Notification notification : recent) {
            NotificationState state = stateById.get(notification.getId());
            if (state == null) {
                state = newState(notification.getId(), context.memberId());
            }
            if (!state.isMarkedRead()) {
                state.setMarkedRead(true);
                changed.add(state);
            }
        }
        states.saveAll(changed);
    }

    @Transactional
    public void dismiss(UUID id) {
        FamilyContext context = directory.context();
        NotificationState state = stateOf(context, id);
        state.setDismissed(true);
        state.setMarkedRead(true);
        states.save(state);
    }

    private List<Notification> visible(FamilyContext context) {
        return notifications.findVisibleTo(context.familyId(), context.memberId(), includeOwnActions, PageRequest.of(0, RECENT));
    }

    /** The same rule as {@code NotificationRepository.findVisibleTo}, for a single notification. */
    private boolean isShownTo(Notification notification, UUID memberId) {
        if (notification.getRecipientMemberId() != null) {
            return notification.getRecipientMemberId().equals(memberId);
        }
        return includeOwnActions || !memberId.equals(notification.getActorMemberId());
    }

    private Map<UUID, NotificationState> statesFor(FamilyContext context, List<Notification> list) {
        Map<UUID, NotificationState> stateById = new HashMap<>();
        if (!list.isEmpty()) {
            for (NotificationState state : states.findByMemberIdAndNotificationIdIn(context.memberId(), list.stream().map(Notification::getId).toList())) {
                stateById.put(state.getNotificationId(), state);
            }
        }
        return stateById;
    }

    private NotificationState stateOf(FamilyContext context, UUID notificationId) {
        // The family check stops a member from touching another family's notification, and one the member
        // would not be shown in their list answers 404 like one that does not exist.
        notifications.findByIdAndFamilyId(notificationId, context.familyId()).filter(notification -> isShownTo(notification, context.memberId()))
                .orElseThrow(() -> ApiException.notFound("That notification"));
        return states.findByNotificationIdAndMemberId(notificationId, context.memberId()).orElseGet(() -> newState(notificationId, context.memberId()));
    }

    private static NotificationState newState(UUID notificationId, UUID memberId) {
        NotificationState state = new NotificationState();
        state.setId(UUID.randomUUID());
        state.setNotificationId(notificationId);
        state.setMemberId(memberId);
        return state;
    }
}
