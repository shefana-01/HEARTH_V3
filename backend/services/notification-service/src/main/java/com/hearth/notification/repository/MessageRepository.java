package com.hearth.notification.repository;

import com.hearth.notification.entity.Message;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByFamilyIdAndChannelOrderByCreatedAtAsc(UUID familyId, String channel);

    /** Polling: only the messages newer than the cursor. */
    List<Message> findByFamilyIdAndChannelAndCreatedAtAfterOrderByCreatedAtAsc(
            UUID familyId, String channel, Instant after);

    /** Text messages in one channel (system lines are not counted). */
    long countByFamilyIdAndChannelAndKind(UUID familyId, String channel, String kind);

    /** Unread count: text messages after the member's last read time. */
    long countByFamilyIdAndChannelAndKindAndCreatedAtAfter(
            UUID familyId, String channel, String kind, Instant after);

    /** Per-task text counts for the badge on a task: rows of [channel, count]. */
    @Query("select m.channel, count(m) from Message m "
            + "where m.familyId = :familyId and m.kind = 'text' and m.channel like 'task:%' "
            + "group by m.channel")
    List<Object[]> countTextMessagesPerTaskChannel(@Param("familyId") UUID familyId);
}
