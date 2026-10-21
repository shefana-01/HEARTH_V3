package com.hearth.notification.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.notification.dto.NotificationView;
import com.hearth.notification.entity.Notification;
import com.hearth.notification.entity.NotificationState;
import com.hearth.notification.repository.NotificationRepository;
import com.hearth.notification.repository.NotificationStateRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notifications for the signed-in member: the ones addressed to them and the family-wide ones, without
 * their own actions (nobody needs to be told what they just did). Read and dismissed are per member.
 */
@Service
public class NotificationService {

    private static final int PAGE = 100;

    private final FamilyDirectory directory;
    private final NotificationRepository notifications;
    private final NotificationStateRepository states;
    private final boolean includeOwnActions;

    public NotificationService(FamilyDirectory directory, NotificationRepository notifications, NotificationStateRepository states, @Value("${hearth.notifications.include-own-actions:false}") boolean includeOwnActions) {
        this.directory = directory;
        this.notifications = notifications;
        this.states = states;
        this.includeOwnActions = includeOwnActions;
    }

    @Transactional(readOnly = true)
    public List<NotificationView> list() {
        FamilyContext context = directory.context();
        List<Notification> visible = notifications.findVisibleTo(context.familyId(), context.memberId(), includeOwnActions, PageRequest.of(0, PAGE));
        Map<UUID, NotificationState> mine = states.findByMemberIdAndNotificationIdIn(context.memberId(), visible.stream().map(Notification::getId).toList()).stream()
                .collect(Collectors.toMap(NotificationState::getNotificationId, Function.identity()));
        return visible.stream()
                .filter(n -> mine.get(n.getId()) == null || !mine.get(n.getId()).isDismissed())
                .map(n -> new NotificationView(n.getId(), n.getType(), n.getMessage(), n.getCreatedAt(), mine.containsKey(n.getId()) && mine.get(n.getId()).isMarkedRead(), n.getHref(), n.getRecipientMemberId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return list().stream().filter(n -> !n.read()).count();
    }

    @Transactional
    public void markRead(UUID id) {
        FamilyContext context = directory.context();
        state(context, find(context, id)).setMarkedRead(true);
    }

    @Transactional
    public void markAllRead() {
        FamilyContext context = directory.context();
        for (NotificationView view : list()) {
            if (!view.read()) {
                state(context, find(context, view.id())).setMarkedRead(true);
            }
        }
    }

    /** Hides it for the caller only; the rest of the family still sees it. */
    @Transactional
    public void dismiss(UUID id) {
        FamilyContext context = directory.context();
        state(context, find(context, id)).setDismissed(true);
    }

    private Notification find(FamilyContext context, UUID id) {
        Notification n = notifications.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That notification"));
        boolean visible = context.memberId().equals(n.getRecipientMemberId())
                || n.getRecipientMemberId() == null && (includeOwnActions || n.getActorMemberId() == null || !n.getActorMemberId().equals(context.memberId()));
        if (!visible) {
            throw ApiException.notFound("That notification");
        }
        return n;
    }

    private NotificationState state(FamilyContext context, Notification n) {
        return states.findByNotificationIdAndMemberId(n.getId(), context.memberId()).orElseGet(() -> {
            NotificationState state = new NotificationState();
            state.setId(UUID.randomUUID());
            state.setNotificationId(n.getId());
            state.setMemberId(context.memberId());
            return states.save(state);
        });
    }
}
