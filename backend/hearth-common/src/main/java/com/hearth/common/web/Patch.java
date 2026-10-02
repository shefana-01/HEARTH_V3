package com.hearth.common.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.common.error.ApiException;
import java.util.function.Consumer;

/**
 * Reads a JSON PATCH body. A field that is absent is left unchanged; a field
 * sent as {@code null} is cleared. A typed DTO cannot tell those two apart.
 */
public final class Patch {

    private final JsonNode body;

    private Patch(JsonNode body) {
        this.body = body;
    }

    public static Patch of(JsonNode body) {
        if (body == null || !body.isObject()) {
            throw ApiException.badRequest("Send the fields to change as a JSON object.");
        }
        return new Patch(body);
    }

    public boolean has(String field) {
        return body.has(field);
    }

    public JsonNode node(String field) {
        return body.get(field);
    }

    /** Applies a text field if it was sent. {@code null} is passed through as null. */
    public Patch text(String field, int maxLength, Consumer<String> setter) {
        if (body.has(field)) {
            JsonNode node = body.get(field);
            String value = node.isNull() ? null : node.asText().trim();
            if (value != null && value.length() > maxLength) {
                throw ApiException.badRequest("\"" + field + "\" must be " + maxLength + " characters or fewer.");
            }
            setter.accept(value);
        }
        return this;
    }

    /** Like {@link #text} but the field cannot be cleared or left blank. */
    public Patch requiredText(String field, int maxLength, Consumer<String> setter) {
        return text(field, maxLength, value -> {
            if (value == null || value.isBlank()) {
                throw ApiException.badRequest("\"" + field + "\" cannot be empty.");
            }
            setter.accept(value);
        });
    }

    public Patch bool(String field, Consumer<Boolean> setter) {
        if (body.has(field) && !body.get(field).isNull()) {
            setter.accept(body.get(field).asBoolean());
        }
        return this;
    }
}
