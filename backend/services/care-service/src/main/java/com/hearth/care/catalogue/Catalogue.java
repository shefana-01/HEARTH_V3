package com.hearth.care.catalogue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hearth.care.dto.CareDtos.ConditionOption;
import com.hearth.care.dto.CareDtos.FoodOption;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * The fixed reference lists: health notes people can tick, everyday foods with what they are good for,
 * and the wording of each food tag. Generated from the frontend's TypeScript by
 * {@code tools/catalogues.mjs}, so both always offer the same choices.
 */
@Component
public class Catalogue {

    private final Map<String, ConditionOption> conditions;
    private final List<FoodOption> foods;
    private final Map<String, FoodOption> foodsById;
    private final Map<String, String> tagLabels;

    public Catalogue(ObjectMapper mapper) {
        List<ConditionOption> conditionList = read(mapper, "catalogue/conditions.json", new TypeReference<>() {
        });
        this.conditions = conditionList.stream().collect(Collectors.toMap(ConditionOption::id, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        this.foods = List.copyOf(read(mapper, "catalogue/foods.json", new TypeReference<List<FoodOption>>() {
        }));
        this.foodsById = foods.stream().collect(Collectors.toMap(FoodOption::id, Function.identity()));
        this.tagLabels = Map.copyOf(read(mapper, "catalogue/tag-labels.json", new TypeReference<Map<String, String>>() {
        }));
    }

    public Optional<ConditionOption> condition(String id) {
        return Optional.ofNullable(conditions.get(id));
    }

    public List<FoodOption> foods() {
        return foods;
    }

    public Optional<FoodOption> food(String id) {
        return Optional.ofNullable(foodsById.get(id));
    }

    public boolean isTag(String tag) {
        return tagLabels.containsKey(tag);
    }

    /** "Iron", "Low salt", ... */
    public String tagLabel(String tag) {
        return tagLabels.getOrDefault(tag, tag);
    }

    private static <T> T read(ObjectMapper mapper, String path, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readValue(in, type);
        } catch (IOException ex) {
            throw new IllegalStateException("Could not read " + path, ex);
        }
    }
}
