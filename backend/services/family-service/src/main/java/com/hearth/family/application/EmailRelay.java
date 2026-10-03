package com.hearth.family.application;

import com.hearth.family.domain.EmailOutbox;
import com.hearth.family.infrastructure.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailRelay {
    private final EmailOutboxRepository outboxRepository;

    @Scheduled(fixedDelay = 5000)
    public void relayEmails() {
        List<EmailOutbox> pending = outboxRepository.findTop50BySentFalseOrderByCreatedAtAsc();
        for (EmailOutbox item : pending) {
            item.setSent(true);
            outboxRepository.save(item);
        }
    }
}
