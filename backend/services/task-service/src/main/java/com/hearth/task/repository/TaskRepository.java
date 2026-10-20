package com.hearth.task.repository;

import com.hearth.task.domain.Task;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    List<Task> findByFamilyIdOrderByStartAtAscIdAsc(UUID familyId);

    Optional<Task> findByIdAndFamilyId(UUID id, UUID familyId);

    List<Task> findByFamilyIdAndAssigneeId(UUID familyId, UUID assigneeId);

    List<Task> findByFamilyIdAndForId(UUID familyId, UUID forId);

    List<Task> findByFamilyIdAndAppointmentId(UUID familyId, UUID appointmentId);

    /** Scheduled tasks of one person that overlap [from, to). */
    @Query("select t from Task t where t.familyId = :familyId and t.assigneeId = :memberId and t.status = 'scheduled' and t.startAt < :to order by t.startAt")
    List<Task> findScheduledStartingBefore(@Param("familyId") UUID familyId, @Param("memberId") UUID memberId, @Param("to") Instant to);

    /** Tasks with a reminder that start between now and {@code until} and have not been reminded about yet. */
    @Query("select t from Task t where t.reminder = true and t.reminderSentAt is null and t.status = 'scheduled' and t.assigneeId is not null and t.startAt > :now and t.startAt <= :until")
    List<Task> findDueReminders(@Param("now") Instant now, @Param("until") Instant until);
}
