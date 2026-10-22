package com.hearth.family.mail;

import com.hearth.family.domain.EmailMessage;
import com.hearth.family.repository.EmailMessageRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends queued email every few seconds. A message that fails stays queued and is tried again later (up to
 * 10 times), so a mail server that is briefly down loses nothing. In Docker the mail goes to Mailpit, a
 * local inbox you can open at http://localhost:8025.
 */
@Component
public class EmailRelay {

    private static final Logger log = LoggerFactory.getLogger(EmailRelay.class);

    private final EmailMessageRepository outbox;
    private final JavaMailSender sender;
    private final String from;

    public EmailRelay(EmailMessageRepository outbox, JavaMailSender sender, @Value("${hearth.mail.from}") String from) {
        this.outbox = outbox;
        this.sender = sender;
        this.from = from;
    }

    @Scheduled(fixedDelayString = "${hearth.mail.poll-ms:5000}")
    @Transactional
    public void send() {
        List<EmailMessage> pending = outbox.lockPending();
        for (EmailMessage message : pending) {
            try {
                SimpleMailMessage mail = new SimpleMailMessage();
                mail.setFrom(from);
                mail.setTo(message.getTo());
                mail.setSubject(message.getSubject());
                mail.setText(message.getBody());
                sender.send(mail);
                message.markSent();
            } catch (MailException ex) {
                message.markFailed(ex.getMessage());
                log.warn("Could not send email (attempt {}): {}", message.getAttempts(), ex.getMessage());
                // The server is probably down: leave the rest for the next run.
                break;
            }
        }
    }
}
