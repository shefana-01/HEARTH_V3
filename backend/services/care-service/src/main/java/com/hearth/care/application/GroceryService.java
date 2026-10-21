package com.hearth.care.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.hearth.care.catalogue.Catalogue;
import com.hearth.care.domain.GroceryItem;
import com.hearth.care.dto.CareDtos.AddFoodRequest;
import com.hearth.care.dto.CareDtos.CustomItemRequest;
import com.hearth.care.dto.CareDtos.FoodOption;
import com.hearth.care.dto.CareDtos.GroceryPatch;
import com.hearth.care.dto.CareDtos.GroceryTaskRequest;
import com.hearth.care.dto.CareDtos.GroceryView;
import com.hearth.care.infrastructure.repository.GroceryItemRepository;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.http.ServiceClient;
import com.hearth.common.text.Formats;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The family's shopping list: one list for the household. Items come from a food suggestion (then they
 * carry a short reason such as "Iron") or are typed in. Naming someone next to an item would reveal a
 * private health note, so only people who share their notes (and dependants) are named.
 */
@Service
public class GroceryService {

    private final FamilyDirectory directory;
    private final GroceryItemRepository items;
    private final Catalogue catalogue;
    private final HealthService health;
    private final ServiceClient services;
    private final String taskServiceUrl;

    public GroceryService(FamilyDirectory directory, GroceryItemRepository items, Catalogue catalogue, HealthService health, ServiceClient services, @Value("${hearth.services.task}") String taskServiceUrl) {
        this.directory = directory;
        this.items = items;
        this.catalogue = catalogue;
        this.health = health;
        this.services = services;
        this.taskServiceUrl = taskServiceUrl;
    }

    @Transactional(readOnly = true)
    public List<GroceryView> list() {
        return items.findByFamilyIdOrderByCreatedAtAsc(directory.context().familyId()).stream().map(GroceryService::view).toList();
    }

    /** Adds a suggested food. Adding the same food again only adds the new people to it. */
    @Transactional
    public GroceryView addFood(AddFoodRequest request) {
        FamilyContext context = directory.context();
        context.requireContributor();
        FoodOption food = catalogue.food(request.foodId()).orElseThrow(() -> ApiException.notFound("That food"));
        List<String> forIds = (request.forIds() == null ? List.<UUID>of() : request.forIds()).stream()
                .filter(id -> id != null && health.shareable(context.familyId(), id))
                .map(UUID::toString)
                .distinct()
                .toList();
        GroceryItem existing = items.findByFamilyIdAndFoodId(context.familyId(), food.id()).orElse(null);
        if (existing != null) {
            Set<String> merged = new LinkedHashSet<>(existing.getForIds());
            merged.addAll(forIds);
            existing.setForIds(new ArrayList<>(merged));
            return view(items.save(existing));
        }
        GroceryItem item = new GroceryItem(context.familyId(), context.memberId());
        item.setName(food.localName() == null ? food.name() : food.name() + " (" + food.localName() + ")");
        item.setGroup(food.group());
        item.setQuantity(1);
        item.setUnit(food.portion());
        item.setEstimatedPrice(food.estimatedPrice());
        item.setFoodId(food.id());
        item.setForIds(new ArrayList<>(forIds));
        String reason = (request.tags() == null ? List.<String>of() : request.tags()).stream()
                .filter(food.tags()::contains)
                .distinct()
                .map(catalogue::tagLabel)
                .collect(Collectors.joining(", "));
        item.setReason(reason.isEmpty() ? null : Formats.clip(reason, 120));
        return view(items.save(item));
    }

    @Transactional
    public GroceryView addCustom(CustomItemRequest request) {
        FamilyContext context = directory.context();
        context.requireContributor();
        String name = Formats.trim(request.name());
        if (name.isEmpty()) {
            throw ApiException.unprocessable("Enter an item name.");
        }
        GroceryItem item = new GroceryItem(context.familyId(), context.memberId());
        item.setName(name);
        item.setGroup("Other");
        item.setQuantity(Math.min(request.quantity(), 999));
        String unit = Formats.trim(request.unit());
        item.setUnit(unit.isEmpty() ? "item" : unit);
        return view(items.save(item));
    }

    @Transactional
    public GroceryView update(UUID id, GroceryPatch patch) {
        FamilyContext context = directory.context();
        context.requireContributor();
        GroceryItem item = find(context, id);
        if (patch.quantity() != null) {
            item.setQuantity(Math.min(patch.quantity(), 999));
        }
        if (patch.status() != null) {
            item.setStatus(patch.status());
        }
        return view(items.save(item));
    }

    @Transactional
    public void remove(UUID id) {
        FamilyContext context = directory.context();
        context.requireContributor();
        items.delete(find(context, id));
    }

    /**
     * Turns everything still to buy into one shopping task for someone. The task is created in
     * task-service as the caller, so the usual checks, activity log and notification apply.
     */
    @Transactional(readOnly = true)
    public JsonNode createShoppingTask(GroceryTaskRequest request) {
        FamilyContext context = directory.context();
        context.requireContributor();
        List<GroceryItem> needed = items.findByFamilyIdOrderByCreatedAtAsc(context.familyId()).stream().filter(g -> GroceryItem.NEEDED.equals(g.getStatus())).toList();
        if (needed.isEmpty()) {
            throw ApiException.unprocessable("There is nothing left to buy.");
        }
        String notes = needed.stream().map(g -> "• " + g.getName() + " — " + g.getQuantity() + " × " + g.getUnit()).collect(Collectors.joining("\n"));
        Map<String, Object> task = new HashMap<>();
        task.put("title", "Shopping (" + needed.size() + " item" + (needed.size() == 1 ? "" : "s") + ")");
        task.put("notes", Formats.clip(notes, 2000));
        task.put("category", "errands");
        task.put("priority", "routine");
        task.put("start", request.start().toString());
        task.put("durationMin", 60);
        task.put("assigneeId", request.assigneeId() == null ? null : request.assigneeId().toString());
        task.put("visibility", "family");
        task.put("reminder", true);
        return services.post(taskServiceUrl + "/api/v1/tasks", task, JsonNode.class);
    }

    /** Someone left the family or is no longer looked after: their name comes off the list. Called by the event listener. */
    @Transactional
    public void personLeft(UUID familyId, UUID personId) {
        String id = personId.toString();
        for (GroceryItem item : items.findByFamilyIdOrderByCreatedAtAsc(familyId)) {
            if (item.getForIds().contains(id)) {
                item.setForIds(new ArrayList<>(item.getForIds().stream().filter(x -> !x.equals(id)).toList()));
            }
        }
    }

    private GroceryItem find(FamilyContext context, UUID id) {
        return items.findByIdAndFamilyId(id, context.familyId()).orElseThrow(() -> ApiException.notFound("That item"));
    }

    static GroceryView view(GroceryItem item) {
        return new GroceryView(item.getId(), item.getName(), item.getGroup(), item.getQuantity(), item.getUnit(), item.getEstimatedPrice(), item.getStatus(), item.getFoodId(), List.copyOf(item.getForIds()), item.getReason(), item.getAddedById());
    }
}
