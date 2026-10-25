package com.hearth.care.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.care.catalogue.Catalogue;
import com.hearth.care.domain.GroceryItem;
import com.hearth.care.dto.CareDtos.CustomItemRequest;
import com.hearth.care.dto.CareDtos.GroceryPatch;
import com.hearth.care.dto.CareDtos.GroceryView;
import com.hearth.care.infrastructure.repository.GroceryItemRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.http.ServiceClient;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GroceryServiceTest {

    private FamilyDirectory directory;
    private GroceryItemRepository items;
    private Catalogue catalogue;
    private HealthService health;
    private ServiceClient services;
    private GroceryService service;

    private final UUID familyId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        items = mock(GroceryItemRepository.class);
        catalogue = mock(Catalogue.class);
        health = mock(HealthService.class);
        services = mock(ServiceClient.class);

        service = new GroceryService(directory, items, catalogue, health, services, "http://localhost:8082");

        FamilyContext context = new FamilyContext(
                UUID.randomUUID(), memberId, "Test Member", familyId, "lead", true, true, true, "UTC");
        when(directory.context()).thenReturn(context);
    }

    @Test
    @DisplayName("list() returns all grocery items for the current family")
    void listReturnsFamilyItems() {
        GroceryItem milk = new GroceryItem(familyId, memberId);
        milk.setName("Milk");
        milk.setQuantity(2);
        milk.setUnit("litres");

        when(items.findByFamilyIdOrderByCreatedAtAsc(familyId)).thenReturn(List.of(milk));

        List<GroceryView> views = service.list();

        assertThat(views).hasSize(1);
        assertThat(views.get(0).name()).isEqualTo("Milk");
        assertThat(views.get(0).quantity()).isEqualTo(2);
    }

    @Test
    @DisplayName("addCustom() creates and saves a new custom item on the shopping list")
    void addCustomItem() {
        when(items.save(any(GroceryItem.class))).thenAnswer(i -> i.getArgument(0));

        CustomItemRequest request = new CustomItemRequest("Almond Milk", 3, "carton");
        GroceryView view = service.addCustom(request);

        assertThat(view).isNotNull();
        assertThat(view.name()).isEqualTo("Almond Milk");
        assertThat(view.quantity()).isEqualTo(3);
        assertThat(view.unit()).isEqualTo("carton");
        verify(items).save(any(GroceryItem.class));
    }

    @Test
    @DisplayName("update() adjusts quantity and updates status to in-pantry")
    void updateItemQuantityAndStatus() {
        UUID itemId = UUID.randomUUID();
        GroceryItem item = new GroceryItem(familyId, memberId);
        item.setName("Eggs");
        item.setQuantity(6);
        item.setStatus(GroceryItem.NEEDED);

        when(items.findByIdAndFamilyId(itemId, familyId)).thenReturn(Optional.of(item));
        when(items.save(any(GroceryItem.class))).thenAnswer(i -> i.getArgument(0));

        GroceryPatch patch = new GroceryPatch(12, "in-pantry");
        GroceryView updated = service.update(itemId, patch);

        assertThat(updated.quantity()).isEqualTo(12);
        assertThat(updated.status()).isEqualTo("in-pantry");
        verify(items).save(item);
    }

    @Test
    @DisplayName("remove() deletes the grocery item by id")
    void removeItem() {
        UUID itemId = UUID.randomUUID();
        GroceryItem item = new GroceryItem(familyId, memberId);

        when(items.findByIdAndFamilyId(itemId, familyId)).thenReturn(Optional.of(item));

        service.remove(itemId);

        verify(items).delete(item);
    }

    @Test
    @DisplayName("personLeft() removes departed person from forIds in grocery items")
    void personLeftRemovesPersonFromItems() {
        UUID personId = UUID.randomUUID();
        GroceryItem item = new GroceryItem(familyId, memberId);
        item.setForIds(List.of(personId.toString(), memberId.toString()));

        when(items.findByFamilyIdOrderByCreatedAtAsc(familyId)).thenReturn(List.of(item));

        service.personLeft(familyId, personId);

        assertThat(item.getForIds()).containsExactly(memberId.toString());
    }
}
