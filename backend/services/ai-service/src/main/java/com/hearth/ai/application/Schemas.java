package com.hearth.ai.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** JSON schemas for the structured answers. Kept small: every field the model may fill is listed. */
final class Schemas {

    static final String CATEGORIES = "\"medication\",\"health\",\"meals\",\"errands\",\"household\",\"childcare\",\"transport\",\"study\",\"work\",\"exercise\",\"family\",\"other\"";

    static final String TASK_DRAFTS = """
            {
              "type": "object",
              "properties": {
                "drafts": {
                  "type": "array",
                  "maxItems": 10,
                  "items": {
                    "type": "object",
                    "properties": {
                      "title": {"type": "string", "description": "Short task name, in the writer's language, at most 80 characters"},
                      "notes": {"type": "string", "description": "Extra details from the note, or an empty string"},
                      "category": {"type": "string", "enum": [%s]},
                      "priority": {"type": "string", "enum": ["routine", "important", "urgent"]},
                      "date": {"type": "string", "description": "YYYY-MM-DD in the family's time zone"},
                      "time": {"type": "string", "description": "HH:mm, 24-hour, in the family's time zone"},
                      "durationMin": {"type": "integer", "minimum": 5, "maximum": 1440},
                      "assignee": {"type": "string", "description": "Alias of the member who will do it (m1, m2, ...), or empty string if none"},
                      "forPerson": {"type": "string", "description": "Alias of the person it is for (m1.., d1..), or empty string if none"},
                      "visibility": {"type": "string", "enum": ["family", "private"]},
                      "reminder": {"type": "boolean"},
                      "reason": {"type": "string", "description": "One plain sentence explaining why this category, priority, time and assignee were chosen"}
                    },
                    "required": ["title", "category", "priority", "date", "time", "durationMin", "visibility"]
                  }
                },
                "assumptions": {"type": "array", "maxItems": 6, "items": {"type": "string"}, "description": "Anything you had to guess, in one short sentence each"}
              },
              "required": ["drafts", "assumptions"]
            }
            """.formatted(CATEGORIES);

    static final String PLAN = """
            {
              "type": "object",
              "properties": {
                "summary": {"type": "string", "description": "Two sentences at most: how the week looks and the main thing to do"},
                "suggestions": {
                  "type": "array",
                  "maxItems": 6,
                  "items": {
                    "type": "object",
                    "properties": {
                      "task": {"type": "string", "description": "Task alias (t1, t2, ...)"},
                      "action": {"type": "string", "enum": ["do_first", "move", "hand_over"]},
                      "newDate": {"type": "string", "description": "For move: YYYY-MM-DD"},
                      "newTime": {"type": "string", "description": "For move: HH:mm, 24-hour"},
                      "to": {"type": "string", "description": "For hand_over: member alias"},
                      "reason": {"type": "string", "description": "One or two plain sentences explaining why this task and person or time were chosen, including priority or suitability factors"}
                    },
                    "required": ["task", "action", "reason"]
                  }
                }
              },
              "required": ["summary", "suggestions"]
            }
            """;

    private Schemas() {
    }

    static ObjectNode parse(ObjectMapper mapper, String schema) {
        try {
            return (ObjectNode) mapper.readTree(schema);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Invalid built-in schema", ex);
        }
    }
}
