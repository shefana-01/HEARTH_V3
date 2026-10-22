package com.hearth.family.repository;

import com.hearth.family.domain.EmailMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EmailMessageRepository extends JpaRepository<EmailMessage, UUID> {

    /** Unsent mail, oldest first. Gives up on a message after 10 attempts. */
    @Query(value = "select * from email_outbox where sent_at is null and attempts < 10 order by created_at limit 20 for update skip locked", nativeQuery = true)
    List<EmailMessage> lockPending();
}
