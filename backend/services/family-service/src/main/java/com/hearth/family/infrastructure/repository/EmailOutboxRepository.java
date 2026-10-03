package com.hearth.family.infrastructure.repository;

import com.hearth.family.domain.EmailOutbox;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, UUID> {
    List<EmailOutbox> findTop50BySentFalseOrderByCreatedAtAsc();
}
