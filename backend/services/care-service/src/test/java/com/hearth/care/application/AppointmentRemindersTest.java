package com.hearth.care.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.care.domain.Appointment;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.common.events.DomainEvent;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Topics;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AppointmentRemindersTest {

    private AppointmentRepository appointments;
    private EventPublisher events;
    private AppointmentReminders reminders;

    private final UUID familyId = UUID.randomUUID();
    private final UUID forId = UUID.randomUUID();
    private final UUID escortId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        appointments = mock(AppointmentRepository.class);
        events = mock(EventPublisher.class);
        reminders = new AppointmentReminders(appointments, events);
    }

    @Test
    @DisplayName("raiseDueReminders() sends notifications for appointments starting within the hour")
    void raiseDueRemindersSendsNotifications() {
        Instant now = Instant.now();
        Instant start = now.plus(30, ChronoUnit.MINUTES);

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setFamilyId(familyId);
        appointment.setTitle("Dentist Checkup");
        appointment.setLocation("Dental Clinic, Banani");
        appointment.setStartAt(start);
        appointment.setDurationMin(45);
        appointment.setForId(forId);
        appointment.setEscortId(escortId);
        appointment.setVisibility(Appointment.FAMILY);
        appointment.setCreatedById(forId);
        appointment.setCreatedAt(now.minus(1, ChronoUnit.DAYS));
        appointment.setTimezone("UTC");

        when(appointments.findDueReminders(any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(appointment));

        reminders.raiseDueReminders();

        assertThat(appointment.getReminderSentAt()).isNotNull();
        verify(appointments).saveAndFlush(appointment);
        org.mockito.Mockito.verify(events, org.mockito.Mockito.times(2)).publish(eq(Topics.CARE), any(DomainEvent.class));
    }

    @Test
    @DisplayName("raiseDueReminders() does nothing when no appointments are due")
    void noRemindersDispatchedWhenNoneDue() {
        when(appointments.findDueReminders(any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());

        reminders.raiseDueReminders();

        verify(appointments, never()).saveAndFlush(any());
        verify(events, never()).publish(any(), any());
    }
}
