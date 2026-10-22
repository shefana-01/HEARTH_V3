package com.hearth.family.mail;

import com.hearth.family.domain.EmailMessage;
import com.hearth.family.repository.EmailMessageRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The emails Hearth sends. Each is queued in the caller's transaction ({@link EmailMessage}) and sent by
 * {@link EmailRelay}; the links point at the web app ({@code hearth.mail.app-url}).
 */
@Component
public class Mailer {

    private final EmailMessageRepository outbox;
    private final String appUrl;

    public Mailer(EmailMessageRepository outbox, @Value("${hearth.mail.app-url}") String appUrl) {
        this.outbox = outbox;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void confirmEmail(String to, String name, String token) {
        queue(to, "Confirm your email for Hearth", """
                Hi %s,

                Please confirm this is your email address by opening the link below:

                %s/verify-email?token=%s

                The link works for 2 days. If you did not create a Hearth account, you can ignore this email.

                — Hearth
                """.formatted(firstName(name), appUrl, encode(token)));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void resetPassword(String to, String name, String token) {
        queue(to, "Reset your Hearth password", """
                Hi %s,

                Someone (hopefully you) asked to reset the password of your Hearth account.
                Open the link below to choose a new one:

                %s/reset-password?token=%s

                The link works for 1 hour and only once. If you did not ask for this, ignore this email:
                your password stays as it is.

                — Hearth
                """.formatted(firstName(name), appUrl, encode(token)));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void invitation(String to, String name, String inviterName, String familyName, String code) {
        queue(to, inviterName + " invited you to " + familyName + " on Hearth", """
                Hi %s,

                %s invited you to join "%s" on Hearth, where your family shares tasks, schedules and
                the things that matter.

                1. Create your account with this email address: %s
                2. Open %s/join/%s (or enter the code %s)

                — Hearth
                """.formatted(firstName(name), inviterName, familyName, to, appUrl, code, code));
    }

    private void queue(String to, String subject, String body) {
        outbox.save(new EmailMessage(to, subject, body));
    }

    private static String firstName(String name) {
        return name == null || name.isBlank() ? "there" : name.trim().split("\\s+")[0];
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
