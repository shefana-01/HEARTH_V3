package com.hearth.common.events;

/** Kafka topics, one per producing service. Messages are keyed by family id, so one family's events stay in order. */
public final class Topics {

    public static final String FAMILY = "hearth.family.events";
    public static final String TASK = "hearth.task.events";
    public static final String DECISION = "hearth.decision.events";
    public static final String CARE = "hearth.care.events";

    private Topics() {
    }
}
