package com.hearth.care.domain;

/** A single preparation checklist entry on an appointment. */
public record PrepItem(String id, String label, boolean done, String doneById) {
}
