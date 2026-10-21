package com.hearth.care.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.care.application.GroceryService;
import com.hearth.care.dto.CareDtos.AddFoodRequest;
import com.hearth.care.dto.CareDtos.CustomItemRequest;
import com.hearth.care.dto.CareDtos.GroceryPatch;
import com.hearth.care.dto.CareDtos.GroceryTaskRequest;
import com.hearth.care.dto.CareDtos.GroceryView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The family's shopping list. */
@RestController
@RequestMapping("/api/v1/groceries")
public class GroceryController {

    private final GroceryService groceries;

    public GroceryController(GroceryService groceries) {
        this.groceries = groceries;
    }

    @GetMapping
    public List<GroceryView> list() {
        return groceries.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroceryView addCustom(@Valid @RequestBody CustomItemRequest request) {
        return groceries.addCustom(request);
    }

    @PostMapping("/from-food")
    @ResponseStatus(HttpStatus.CREATED)
    public GroceryView addFood(@Valid @RequestBody AddFoodRequest request) {
        return groceries.addFood(request);
    }

    @PatchMapping("/{id}")
    public GroceryView update(@PathVariable UUID id, @Valid @RequestBody GroceryPatch patch) {
        return groceries.update(id, patch);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        groceries.remove(id);
    }

    /** Creates one shopping task (in task-service) for everything still to buy, and returns it. */
    @PostMapping("/task")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createShoppingTask(@Valid @RequestBody GroceryTaskRequest request) {
        return groceries.createShoppingTask(request);
    }
}
