package com.hearth.notification.live;

import java.util.LinkedHashSet;
import java.util.Set;

/** Which parts of the app an event type touches. The browser reloads the pages showing those parts. */
public final class Scopes {

    public static final String TASKS = "tasks";
    public static final String PLAN = "plan";
    public static final String CARE = "care";
    public static final String FAMILY = "family";
    public static final String NOTIFICATIONS = "notifications";
    public static final String CHAT = "chat";

    private Scopes() {
    }

    public static Set<String> of(String eventType) {
        Set<String> scopes = new LinkedHashSet<>();
        if (eventType == null) {
            return scopes;
        }
        String prefix = eventType.contains(".") ? eventType.substring(0, eventType.indexOf('.')) : eventType;
        switch (prefix) {
            case "task", "unavailability" -> {
                scopes.add(TASKS);
                scopes.add(PLAN);
            }
            case "handover", "plan" -> {
                scopes.add(PLAN);
                scopes.add(TASKS);
            }
            case "appointment", "document", "health", "grocery", "medication", "emergency" -> scopes.add(CARE);
            case "family", "member", "availability", "dependant" -> {
                scopes.add(FAMILY);
                scopes.add(PLAN);
            }
            default -> {
                // unknown: nothing to reload
            }
        }
        return scopes;
    }
}
